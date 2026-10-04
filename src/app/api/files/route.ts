import { createRoute } from "@/server/http/route";
import { created, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { fileCreateSchema, paginationSchema } from "@/lib/api/schemas";
import * as fileService from "@/server/services/fileService";
import { getSettings } from "@/server/services/settingsService";
import { getEnv } from "@/server/config/env";
import { ValidationError } from "@/server/errors";

/**
 * GET /api/files — the caller's file metadata.
 * POST /api/files — two modes:
 *   - multipart/form-data (`file` part): a real upload. Bytes are validated
 *     (size, extension, magic bytes), persisted through the storage provider,
 *     processed (extract + chunk), and the resulting status is real.
 *   - JSON ({filename,mimeType,size}): metadata-only registration, retained
 *     for API compatibility; such a row never becomes READY on its own.
 */

const SERVER_MAX_MB = 128;

export const GET = createRoute("files/list", async (request) => {
  const auth = await requireUser({ requestId: "", method: "GET", route: "files/list" });

  const url = new URL(request.url);
  const query = parseOrThrow(paginationSchema, {
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });

  return ok(
    await fileService.list(auth.userId, {
      limit: query.limit,
      cursor: query.cursor,
    })
  );
});

export const POST = createRoute("files/create", async (request) => {
  const auth = await requireUser({ requestId: "", method: "POST", route: "files/create" });
  enforceRateLimit(auth.userId, RATE_LIMITS.fileCreate);

  const contentType = request.headers.get("content-type") ?? "";
  const settings = await getSettings(auth.userId);
  const maxMb = Math.min(settings.files.maxFileSizeMb, Math.min(getEnv().FILE_MAX_SIZE_MB, SERVER_MAX_MB));

  if (contentType.includes("multipart/form-data")) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > maxMb * 1024 * 1024 + 1024 * 64) {
      throw new ValidationError(`Files must be ${maxMb} MB or smaller.`);
    }
    const form = await request.formData();
    const part = form.get("file");
    if (!(part instanceof File)) {
      throw new ValidationError(
        "Attach the file in a multipart form-data 'file' part."
      );
    }
    const file = await fileService.createWithUpload(auth.userId, {
      filename: part.name,
      mimeType: part.type || "application/octet-stream",
      size: part.size,
      body: new Uint8Array(await part.arrayBuffer()),
      maxMb,
    });
    return created({ file });
  }

  const input = parseOrThrow(fileCreateSchema, await readJson(request));
  const file = await fileService.create(auth.userId, input, maxMb);

  return created({
    file,
    storage: (await import("@/server/storage/storageProvider")).storageStatus,
    processing: { connected: true, reason: undefined },
  });
});
