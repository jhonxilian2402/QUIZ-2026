import { and, desc, eq, lt, ne } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { uploadedFiles } from "../db/schema";
import type { FileStatus, UploadedFileResponse } from "@/lib/api/contracts";

/**
 * Uploaded file repository.
 *
 * Only metadata lives here: the database never stores file contents. Status
 * transitions are explicit so the lifecycle is visible from the data.
 */

export type FileRow = typeof uploadedFiles.$inferSelect;

export async function listFiles(options: {
  userId: string;
  limit: number;
  cursor?: string | null;
}): Promise<{ items: FileRow[]; nextCursor: string | null }> {
  await ensureDbReady();
  const conditions = [
    eq(uploadedFiles.userId, options.userId),
    ne(uploadedFiles.status, "deleted"),
  ];
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(uploadedFiles.createdAt, cursorDate));
    }
  }

  const rows = await getDb()
    .select()
    .from(uploadedFiles)
    .where(and(...conditions))
    .orderBy(desc(uploadedFiles.createdAt))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
  return { items, nextCursor };
}

export async function insertFile(input: {
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey?: string | null;
  status?: FileStatus;
  checksum?: string | null;
}): Promise<FileRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(uploadedFiles)
    .values({
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      storageKey: input.storageKey ?? null,
      status: input.status ?? "uploading",
      checksum: input.checksum ?? null,
    })
    .returning();
  return row;
}

export async function findFileForUser(
  id: string,
  userId: string
): Promise<FileRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function updateFileStatus(
  id: string,
  userId: string,
  status: FileStatus,
  storageKey?: string | null
): Promise<FileRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .update(uploadedFiles)
    .set({
      status,
      ...(storageKey !== undefined ? { storageKey } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)))
    .returning();
  return row ?? null;
}

/**
 * Marks a file as deleted. The row is retained (soft deletion) so a storage
 * cleanup job can remove the object later without losing the audit trail.
 */
export async function softDeleteFile(id: string, userId: string): Promise<FileRow | null> {
  return updateFileStatus(id, userId, "deleted");
}

/** Applies the outcome of a processing run in one write. */
export async function setFileProcessingResult(
  id: string,
  result: {
    status: FileStatus;
    error?: string | null;
    pageCount?: number | null;
    wordCount?: number | null;
    language?: string | null;
  }
): Promise<FileRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .update(uploadedFiles)
    .set({
      status: result.status,
      error: result.error ?? null,
      pageCount: result.pageCount ?? null,
      wordCount: result.wordCount ?? null,
      language: result.language ?? null,
      updatedAt: new Date(),
    })
    .where(eq(uploadedFiles.id, id))
    .returning();
  return row ?? null;
}

export function toFileResponse(row: FileRow): UploadedFileResponse {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    status: row.status,
    error: row.error ?? null,
    pageCount: row.pageCount,
    wordCount: row.wordCount,
    language: row.language,
    checksum: row.checksum,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}