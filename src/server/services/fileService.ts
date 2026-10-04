import {
  findFileForUser,
  insertFile,
  listFiles,
  setFileProcessingResult,
  softDeleteFile,
  toFileResponse,
  updateFileStatus,
} from "../repositories/fileRepository";
import {
  deleteChunksForFile,
  insertChunks,
  listChunksForFile,
  searchChunks,
} from "../repositories/chunkRepository";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import { getStorage } from "../storage/storageProvider";
import { getEnv } from "../config/env";
import {
  chunkText,
  inferKind,
  processFileBuffer,
} from "./fileProcessingService";
import type { FileStatus, Page, UploadedFileResponse } from "@/lib/api/contracts";
import type { FileCreateInput } from "@/lib/api/schemas";
import { createHash } from "node:crypto";

/**
 * File service.
 *
 * Records file metadata and its lifecycle. Bytes never touch the database and
 * no processing pipeline exists yet, so a file stops at `uploading` until the
 * storage provider can accept it.
 */

/** Extensions the interface advertises. The browser-provided MIME type is not
 * trusted on its own, so the extension is checked too. */
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "txt", "md", "doc", "docx", "ppt", "pptx", "png", "jpg", "jpeg", "webp",
]);

const ALLOWED_MIME_PREFIXES = ["application/", "image/", "text/"];

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Validates an upload request before any metadata is stored. Both the
 * extension and the declared MIME type must be plausible, and the size must be
 * within the server limit rather than whatever the client chose.
 */
export function assertUploadAllowed(input: FileCreateInput, maxMb: number): void {
  const extension = extensionOf(input.filename);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new ValidationError("That file type is not supported.", {
      details: { filename: [`Unsupported extension ".${extension}".`] },
    });
  }

  const mimeAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    input.mimeType.startsWith(prefix)
  );
  if (!mimeAllowed) {
    throw new ValidationError("That file type is not supported.", {
      details: { mimeType: [`Unsupported MIME type "${input.mimeType}".`] },
    });
  }

  const maxBytes = maxMb * 1024 * 1024;
  if (input.size > maxBytes) {
    throw new ValidationError(`Files must be ${maxMb} MB or smaller.`, {
      details: { size: [`Maximum size is ${maxMb} MB.`] },
    });
  }
}

/**
 * A file stuck in `processing` beyond the timeout means the run was
 * interrupted; fail it so the file is retryable instead of wedged forever.
 */
async function failStaleProcessing(row: { id: string; status: string; updatedAt: Date }): Promise<void> {
  if (row.status !== "processing") return;
  const staleBefore = Date.now() - getEnv().FILE_PROCESSING_TIMEOUT_MS * 2;
  if (row.updatedAt.getTime() < staleBefore) {
    await setFileProcessingResult(row.id, {
      status: "failed",
      error: "Processing did not finish in time. You can retry it.",
    });
  }
}

export async function list(
  userId: string,
  options: { limit: number; cursor?: string }
): Promise<Page<UploadedFileResponse>> {
  const { items } = await listFiles({
    userId,
    limit: options.limit,
    cursor: options.cursor ?? null,
  });
  await Promise.all(items.map((row) => failStaleProcessing(row).catch(() => undefined)));
  const fresh = await listFiles({ userId, limit: options.limit, cursor: options.cursor ?? null });
  return { items: fresh.items.map(toFileResponse), nextCursor: fresh.nextCursor };
}

export async function create(
  userId: string,
  input: FileCreateInput,
  maxMb: number
): Promise<UploadedFileResponse> {
  assertUploadAllowed(input, maxMb);

  const row = await insertFile({
    userId,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    // No storage provider is connected, so no storage key is claimed.
    storageKey: null,
    status: "uploading",
  });

  logger.info("File metadata created", { userId, route: "files" });
  return toFileResponse(row);
}

export async function getById(
  userId: string,
  fileId: string
): Promise<UploadedFileResponse> {
  const row = await findFileForUser(fileId, userId);
  if (!row) throw new NotFoundError("File not found.");
  await failStaleProcessing(row).catch(() => undefined);
  const fresh = await findFileForUser(fileId, userId);
  return toFileResponse(fresh ?? row);
}

export async function updateStatus(
  userId: string,
  fileId: string,
  status: FileStatus
): Promise<UploadedFileResponse> {
  const row = await updateFileStatus(fileId, userId, status);
  if (!row) throw new NotFoundError("File not found.");
  return toFileResponse(row);
}

/* ---------------- Real upload ---------------- */

/**
 * Real end-to-end upload: bytes are checked (size, extension, magic bytes),
 * persisted through the storage provider, then processed into normalized,
 * chunked text whose row state — never the filename — drives facts.
 */
export async function createWithUpload(
  userId: string,
  input: {
    filename: string;
    mimeType: string;
    size: number;
    body: Uint8Array;
    maxMb: number;
  }
): Promise<UploadedFileResponse> {
  const maxBytes = input.maxMb * 1024 * 1024;
  if (input.size > maxBytes) {
    throw new ValidationError(`Files must be ${input.maxMb} MB or smaller.`);
  }

  const extension = extensionOf(input.filename);
  if (!ALLOWED_EXTENSIONS.has(extension) || !inferKind(extension)) {
    throw new ValidationError("That file type is not supported.", {
      details: { filename: [`Unsupported extension ".${extension}".`] },
    });
  }

  const checksum = createHash("sha256").update(input.body).digest("hex");

  // Magic-byte check before we persist bytes we are about to process.
  const signatureOk = verifySignature(input.body, extension);
  if (!signatureOk) {
    throw new ValidationError("The file content does not match its extension.", {
      details: { filename: ["Signature mismatch."] },
    });
  }

  const storage = getStorage();
  const put = await storage.put({
    userId,
    filename: input.filename,
    mimeType: input.mimeType,
    body: input.body,
  });

  const row = await insertFile({
    userId,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    storageKey: put.storageKey,
    status: "processing",
    checksum,
  });

  try {
    const result = await processFileBuffer(input.body, extension);
    await deleteChunksForFile(row.id);
    const chunks = chunkText(result.pages);
    await insertChunks(row.id, userId, chunks);

    const text = result.pages.map((page) => page.text).join("\n\n");
    const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

    await setFileProcessingResult(row.id, {
      status: "ready",
      error: null,
      pageCount: result.pageCount,
      wordCount,
      language: result.language,
    });
    logger.info("File processed", {
      userId,
      route: "files",
      filename: input.filename,
      pages: result.pageCount,
      words: wordCount,
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "The file could not be processed.";
    await setFileProcessingResult(row.id, { status: "failed", error: message });
    logger.warn("File processing failed", {
      userId,
      route: "files",
      filename: input.filename,
      errorCategory: message,
    });
  }

  const fresh = await findFileForUser(row.id, userId);
  return toFileResponse(fresh ?? row);
}

/** Reprocesses a stored file. Safe to retry after a failure; guarded by row state. */
export async function retryProcessing(
  userId: string,
  fileId: string
): Promise<UploadedFileResponse> {
  let row = await findFileForUser(fileId, userId);
  if (!row) throw new NotFoundError("File not found.");
  if (!row.storageKey) throw new ValidationError("There is no stored file to process.");
  if (row.status === "ready") return toFileResponse(row);
  if (row.status === "deleted") throw new ValidationError("A deleted file cannot be processed.");
  await failStaleProcessing(row).catch(() => undefined);
  row = (await findFileForUser(fileId, userId)) ?? row;
  if (row.status === "processing") {
    // Prevent duplicate concurrent processing runs.
    throw new ConflictError("This file is already being processed.");
  }

  const storageKey = row.storageKey;
  await setFileProcessingResult(row.id, { status: "processing", error: null });

  const body = await getStorage().get(storageKey!);
  if (!body) {
    await setFileProcessingResult(row.id, {
      status: "failed",
      error: "Stored bytes were not found; re-upload the file.",
    });
    return toFileResponse((await findFileForUser(row.id, userId)) ?? row);
  }

  try {
    const extension = extensionOf(row.filename);
    const result = await processFileBuffer(body, extension);
    await deleteChunksForFile(row.id);
    const chunks = chunkText(result.pages);
    await insertChunks(row.id, userId, chunks);

    const text = result.pages.map((page) => page.text).join("\n\n");
    const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

    await setFileProcessingResult(row.id, {
      status: "ready",
      error: null,
      pageCount: result.pageCount,
      wordCount,
      language: result.language,
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "The file could not be processed.";
    await setFileProcessingResult(row.id, { status: "failed", error: message });
  }

  const fresh = await findFileForUser(row.id, userId);
  return toFileResponse(fresh ?? row);
}

/** Real text content with pagination semantics (chars), for the content endpoint. */
export async function content(
  userId: string,
  fileId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{ fileId: string; text: string; offset: number; total: number }> {
  const row = await findFileForUser(fileId, userId);
  if (!row) throw new NotFoundError("File not found.");
  if (row.status !== "ready") {
    throw new ValidationError(
      `File "${row.filename}" is not ready (status: ${row.status}).`
    );
  }

  const chunks = await listChunksForFile(fileId, userId);
  const full = chunks.map((chunk) => chunk.content).join("\n\n");
  const offset = Math.max(0, Math.min(options.offset ?? 0, full.length));
  const limit = Math.min(Math.max(options.limit ?? 8000, 1), 40000);
  return { fileId, text: full.slice(offset, offset + limit), offset, total: full.length };
}

export type FileSearchResult = {
  fileId: string;
  filename: string;
  page: number | null;
  position: number;
  content: string;
  rank: number;
};

/** Lexical owner-scoped search; ever-increasing capability for vector search. */
export async function search(
  userId: string,
  input: { query: string; fileIds?: string[] | null; limit?: number }
): Promise<FileSearchResult[]> {
  const hits = await searchChunks({
    userId,
    query: input.query,
    fileIds: input.fileIds ?? null,
    limit: input.limit ?? 8,
  });
  return hits;
}

/** Verifies real server-side magic bytes; extension alone is never trusted. */
export function verifySignature(body: Uint8Array, extension: string): boolean {
  const b = body;
  const starts = (bytes: number[]) =>
    bytes.every((value, index) => index < b.length && b[index] === value);
  switch (extension) {
    case "pdf":
      return starts([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "png":
      return starts([0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "webp":
      return /** RIFF....WEBP */ b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
    case "docx":
    case "pptx":
      return starts([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
    case "txt":
    case "md":
      {
        // Text files must not have NUL bytes before reasonable count.
        const sample = b.slice(0, Math.min(b.length, 512));
        return !sample.includes(0);
      }
    default:
      return false;
  }
}

/** Soft deletion: chunks and stored bytes go away; the row stays auditable. */
export async function remove(userId: string, fileId: string): Promise<void> {
  const row = await softDeleteFile(fileId, userId);
  if (!row) throw new NotFoundError("File not found.");

  await deleteChunksForFile(fileId).catch((error) => {
    logger.warn("Chunk cleanup failed during file delete", {
      userId,
      route: "files",
      detail: error instanceof Error ? error.message : String(error),
    });
  });

  try {
    if (row.storageKey) await getStorage().remove(row.storageKey);
  } catch (error) {
    logger.warn("Storage cleanup failed during file delete", {
      userId,
      route: "files",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  logger.info("File marked deleted", { userId, route: "files" });
}

/** True when the row is owned by the user and ready for grounding. */
export async function assertUsableForGrounding(
  userId: string,
  fileIds: string[]
): Promise<void> {
  for (const fileId of fileIds) {
    const row = await findFileForUser(fileId, userId);
    if (!row) throw new NotFoundError(`File not found: ${fileId}`);
    if (row.status !== "ready") {
      throw new ValidationError(
        `File "${row.filename}" is not ready (status: ${row.status}).`
      );
    }
  }
}

/** Metadata-only branch kept for backwards compatibility of POST /api/files. */
export async function assertMetadataOnlyFile(
  userId: string,
  input: FileCreateInput,
  maxMb: number
): Promise<void> {
  assertUploadAllowed(input, maxMb);
}