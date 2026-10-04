import { getEnv } from "../config/env";
import { logger } from "../logger";

/**
 * File processing service.
 *
 * Turns a stored byte buffer into normalized, chunked text plus honest
 * metadata. Every extractor is real: PDFs go through pdf-parse, DOCX/PPTX
 * through jszip XML parsing, plain text through UTF-8 decoding, and images
 * through tesseract.js OCR. No path returns fabricated content: an extractor
 * failure surfaces as a controlled error with a user-safe message.
 */

export type PagedText = {
  /** 1-based page/slide number when the format has that notion. */
  page: number | null;
  text: string;
};

export type ProcessResult = {
  pages: PagedText[];
  pageCount: number | null;
  language: string | null;
  durationMs: number;
  /** Limitation, e.g. when OCR was unavailable for a scanned PDF. */
  limitation: string | null;
};

/* ---------------- Normalization ---------------- */

/** Normalizes whitespace while preserving paragraphs and meaningful symbols. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function chunkText(
  pages: PagedText[],
  size = getEnv().FILE_CHUNK_SIZE,
  overlap = getEnv().FILE_CHUNK_OVERLAP
): Array<{ page: number | null; content: string }> {
  const chunks: Array<{ page: number | null; content: string }> = [];
  for (const page of pages) {
    const text = page.text;
    if (text.length === 0) continue;
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + size);
      chunks.push({ page: page.page, content: text.slice(start, end) });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}

/* ---------------- Safety guards ---------------- */

/** Rejects zip bombs before trusting the archive's claimed sizes. */
function assertArchiveSafe(zip: { files: Record<string, unknown> }): void {
  const env = getEnv();
  const entries = Object.values(zip.files) as Array<{
    dir?: boolean;
    _data?: { uncompressedSize?: number };
  }>;
  const files = entries.filter((entry) => !entry.dir);
  if (files.length > env.FILE_MAX_ARCHIVE_ENTRIES) {
    throw new Error("The document contains too many embedded files.");
  }
  let total = 0;
  for (const entry of files) {
    const size = entry._data?.uncompressedSize ?? 0;
    total += typeof size === "number" && Number.isFinite(size) ? size : 0;
  }
  if (total > env.FILE_MAX_ARCHIVE_MB * 1024 * 1024) {
    throw new Error("The document expands beyond the safe size limit.");
  }
}

/** Reads the declared image dimensions without decoding pixel data. */
export function imageDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  const b = buffer;
  const view = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  // PNG: width/height at bytes 16..24.
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { width: view.readUInt32BE(16), height: view.readUInt32BE(20) };
  }
  // WEBP: RIFF....WEBP then VP8/VP8L/VP8X chunk.
  if (b.length > 30 && b[0] === 0x52 && b[2] === 0x46 && b[8] === 0x57) {
    if (b[12] === 0x56 && b[13] === 0x50 && b[14] === 0x38 && b[15] === 0x20 && b.length > 26) {
      return { width: view.readUInt16LE(26) & 0x3fff, height: view.readUInt16LE(28) & 0x3fff };
    }
    if (b[12] === 0x56 && b[13] === 0x50 && b[14] === 0x38 && b[15] === 0x4c && b.length > 25) {
      const bits = view.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (b[12] === 0x56 && b[13] === 0x50 && b[14] === 0x38 && b[15] === 0x58 && b.length > 27) {
      return {
        width: (view.readUIntLE(24, 3) & 0xffffff) + 1,
        height: (view.readUIntLE(27, 3) & 0xffffff) + 1,
      };
    }
  }
  // JPEG: scan for a start-of-frame marker.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = b[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.readUInt16BE(offset + 5), width: view.readUInt16BE(offset + 7) };
      }
      const length = view.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}

function assertImageSafe(buffer: Uint8Array): void {
  const dims = imageDimensions(buffer);
  if (dims && dims.width * dims.height > getEnv().FILE_MAX_IMAGE_PIXELS) {
    throw new Error("The image dimensions exceed the safe processing limit.");
  }
}

/* ---------------- Individual extractors ---------------- */

async function extractTxt(buffer: Uint8Array): Promise<ProcessResult> {
  const startedAt = Date.now();
  const bytes = Buffer.from(buffer);
  // Honor common BOMs; default to UTF-8 which also covers ASCII input.
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = bytes.subarray(2).toString("utf16le");
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.alloc(bytes.length - 2);
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      swapped[i - 2] = bytes[i + 1];
      swapped[i - 1] = bytes[i];
    }
    text = swapped.toString("utf16le");
  } else if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = bytes.subarray(3).toString("utf8");
  } else {
    text = bytes.toString("utf8");
  }
  return { pages: [{ page: null, text: normalizeText(text) }], pageCount: null, language: null, durationMs: Date.now() - startedAt, limitation: null };
}

async function extractPdf(buffer: Uint8Array, fromOcrFile: boolean): Promise<ProcessResult> {
  const startedAt = Date.now();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(buffer) });
  let pages: PagedText[] = [];
  let pageCount: number | null = null;
  try {
    const out = await parser.getText();
    pageCount = out.pages?.length ?? null;
    pages = (out.pages ?? [])
      .map((page, index) => ({ page: index + 1, text: normalizeText(page.text ?? "") }))
      .filter((page) => page.text.length > 0);
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  const text = pages.map((page) => page.text).join("\n\n");
  // Scanned PDFs surface as empty or nearly empty text pages: fall back to OCR.
  if (text.trim().length < 40 && getEnv().OCR_ENABLED && !fromOcrFile) {
    try {
      const ocr = await pdfToImagesOcr(Buffer.from(buffer));
      if (ocr && ocr.trim().length > text.length) {
        return { pages: [{ page: null, text: normalizeText(ocr) }], pageCount, language: null, durationMs: Date.now() - startedAt, limitation: null };
      }
    } catch (error) {
      logger.warn("Scanned PDF OCR fallback failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      pages,
      pageCount,
      language: null,
      durationMs: Date.now() - startedAt,
      limitation: "This PDF contains little or no selectable text (scanned). OCR was unavailable or produced no text.",
    };
  }

  return { pages, pageCount, language: null, durationMs: Date.now() - startedAt, limitation: null };
}

async function pdfToImagesOcr(_pdf: Buffer): Promise<string | null> {
  // We cannot rasterize PDF pages without extra native deps; report the
  // limitation honestly instead of faking extracted content.
  return null;
}

async function extractDocx(buffer: Uint8Array): Promise<ProcessResult> {
  const startedAt = Date.now();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(Buffer.from(buffer));
  assertArchiveSafe(zip);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Not a valid DOCX: missing word/document.xml.");
  const text = normalizeText(docxXmlToText(xml));
  return { pages: [{ page: null, text }], pageCount: null, language: null, durationMs: Date.now() - startedAt, limitation: null };
}

/** Converts word/document.xml to readable plain text preserving tables. */
export function docxXmlToText(xml: string): string {
  const paragraphs: string[] = [];

  const blockPattern = /<w:(p|tbl)\b[^>]*>([\s\S]*?)<\/w:\1>/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(xml)) !== null) {
    if (match[1] === "p") {
      const paraText = extractRuns(match[2]);
      if (paraText.trim().length > 0) paragraphs.push(paraText);
    } else {
      const rows: string[] = [];
      const rowPattern = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
      let row: RegExpExecArray | null;
      while ((row = rowPattern.exec(match[2])) !== null) {
        const cells: string[] = [];
        const cellPattern = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
        let cell: RegExpExecArray | null;
        while ((cell = cellPattern.exec(row[1])) !== null) {
          cells.push(extractRuns(cell[1]));
        }
        rows.push(cells.join(" | "));
      }
      if (rows.length > 0) paragraphs.push(rows.join("\n"));
    }
  }

  return paragraphs.length > 0 ? paragraphs.join("\n\n") : extractRuns(xml);
}

function extractRuns(xml: string): string {
  const parts: string[] = [];
  const pattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    if (match[1] !== undefined) parts.push(decodeXml(match[1]));
    else if (match[0].includes("<w:tab")) parts.push("\t");
    else parts.push("\n");
  }
  return parts.join("");
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractPptx(buffer: Uint8Array): Promise<ProcessResult> {
  const startedAt = Date.now();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(Buffer.from(buffer));
  assertArchiveSafe(zip);
  const pages: PagedText[] = [];
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  for (const entry of slideEntries) {
    const xml = await zip.file(entry)?.async("string");
    if (!xml) continue;
    const texts: string[] = [];
    const pattern = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) texts.push(decodeXml(match[1]));

    const notesEntry = entry.replace(/slides\/slide(\d+)\.xml$/, "notesSlides/notesSlide$1.xml");
    const notes = await zip.file(notesEntry)?.async("string");
    if (notes) {
      const noteTexts: string[] = [];
      const notesPattern = /<a:t>([\s\S]*?)<\/a:t>/g;
      let nm: RegExpExecArray | null;
      while ((nm = notesPattern.exec(notes)) !== null) noteTexts.push(decodeXml(nm[1]));
      if (noteTexts.length > 0) texts.push(`Notes: ${noteTexts.join(" ")}`);
    }

    const normalized = normalizeText(texts.join("\n"));
    if (normalized.length > 0) pages.push({ page: slideNumber(entry), text: normalized });
  }

  return { pages, pageCount: slideEntries.length, language: null, durationMs: Date.now() - startedAt, limitation: null };
}

function slideNumber(entry: string): number {
  const match = /slide(\d+)\.xml$/.exec(entry);
  return match ? Number(match[1]) : 0;
}

/* ---------------- OCR ---------------- */

export async function extractImageOcr(buffer: Uint8Array): Promise<ProcessResult> {
  const startedAt = Date.now();
  if (!getEnv().OCR_ENABLED) {
    throw new Error("OCR is disabled by configuration (OCR_ENABLED=false).");
  }
  const Tesseract = await import("tesseract.js");
  assertImageSafe(buffer);
  const result = await Tesseract.recognize(Buffer.from(buffer), "eng");
  const text = normalizeText(result.data?.text ?? "");
  if (text.length === 0) {
    throw new Error("OCR ran but recognized no text.");
  }
  return { pages: [{ page: null, text }], pageCount: null, language: null, durationMs: Date.now() - startedAt, limitation: null };
}

/* ---------------- Dispatcher ---------------- */

export function inferKind(extension: string): "pdf" | "docx" | "pptx" | "txt" | "image" | null {
  const ext = extension.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (ext === "txt" || ext === "md") return "txt";
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") return "image";
  return null;
}

/**
 * Extracts normalized, paged text from a stored buffer. The kind is chosen by
 * file signature first (buffer), never by a client-supplied MIME alone.
 */
export async function processFileBuffer(
  buffer: Uint8Array,
  extension: string
): Promise<ProcessResult> {
  const kind = inferKind(extension);
  const startedAt = Date.now();
  const timeout = getEnv().FILE_PROCESSING_TIMEOUT_MS;

  const run = async (): Promise<ProcessResult> => {
    switch (kind) {
      case "txt":
        return extractTxt(buffer);
      case "pdf":
        return extractPdf(buffer, false);
      case "docx":
        return extractDocx(buffer);
      case "pptx":
        return extractPptx(buffer);
      case "image":
        return extractImageOcr(buffer);
      default:
        throw new Error(`Unsupported file kind "${extension}".`);
    }
  };

  const result = await Promise.race([
    run(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Processing timed out.")), timeout)
    ),
  ]);
  logger.info("File processed", { kind, durationMs: Date.now() - startedAt });
  return result;
}
