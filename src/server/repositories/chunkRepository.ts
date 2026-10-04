import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { documentChunks, uploadedFiles } from "../db/schema";

/**
 * Chunk repository. Every lookup is owner-scoped so no chunk of a private
 * document can ever be harvested by guessing file or user ids.
 */

export type ChunkRow = typeof documentChunks.$inferSelect;

export async function insertChunks(
  fileId: string,
  userId: string,
  chunks: Array<{ page: number | null; content: string }>
): Promise<void> {
  await ensureDbReady();
  if (chunks.length === 0) return;
  await getDb()
    .insert(documentChunks)
    .values(
      chunks.map((chunk, index) => ({
        fileId,
        userId,
        position: index + 1,
        page: chunk.page,
        content: chunk.content,
        charCount: chunk.content.length,
      }))
    );
}

export async function deleteChunksForFile(fileId: string): Promise<void> {
  await ensureDbReady();
  await getDb().delete(documentChunks).where(eq(documentChunks.fileId, fileId));
}

/** Full ordered chunk list for a file (used to ground generations). */
export async function listChunksForFile(
  fileId: string,
  userId: string
): Promise<ChunkRow[]> {
  await ensureDbReady();
  return getDb()
    .select()
    .from(documentChunks)
    .where(and(eq(documentChunks.fileId, fileId), eq(documentChunks.userId, userId)))
    .orderBy(asc(documentChunks.position));
}

export type ChunkSearchHit = {
  fileId: string;
  filename: string;
  page: number | null;
  content: string;
  position: number;
  /** Rough relevance signal: lower is better. */
  rank: number;
};

/**
 * Lexical relevance: terms from the query must appear in the chunk; hits are
 * ranked by term frequency. Simple and predictable; a vector index can be
 * layered later without changing the contract.
 */
export async function searchChunks(options: {
  userId: string;
  query: string;
  fileIds?: string[] | null;
  limit?: number;
}): Promise<ChunkSearchHit[]> {
  await ensureDbReady();
  const query = options.query.trim();
  if (query.length === 0) return [];
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);

  const terms = query
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((term) => term.length >= 2);
  if (terms.length === 0) return [];

  const conditions = [eq(documentChunks.userId, options.userId)];
  if (options.fileIds && options.fileIds.length > 0) {
    conditions.push(inArray(documentChunks.fileId, options.fileIds));
  }
  conditions.push(
    or(...terms.map((term) => ilike(documentChunks.content, `%${term}%`)))!
  );

  const rows = await getDb()
    .select({
      chunk: documentChunks,
      filename: uploadedFiles.filename,
    })
    .from(documentChunks)
    .innerJoin(uploadedFiles, eq(documentChunks.fileId, uploadedFiles.id))
    .where(and(...conditions))
    .orderBy(asc(documentChunks.position))
    .limit(limit * 4);

  const hits = rows.map((row) => {
    const text = row.chunk.content.toLowerCase();
    let rank = 0;
    for (const term of terms) {
      let idx = text.indexOf(term);
      while (idx !== -1) {
        rank += 1;
        idx = text.indexOf(term, idx + term.length);
      }
    }
    return {
      fileId: row.chunk.fileId,
      filename: row.filename,
      page: row.chunk.page,
      content: row.chunk.content,
      position: row.chunk.position,
      rank,
    };
  });

  hits.sort((a, b) => b.rank - a.rank);
  return hits.slice(0, limit);
}
