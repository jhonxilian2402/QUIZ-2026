import { z } from "zod";
import { getEnv } from "../config/env";
import { AIError } from "../errors";
import { logger } from "../logger";
import { generate } from "./aiService";
import { assertSafeRemoteBaseUrl } from "./remoteFetchGuard";
import {
  buildWebQuizMessages,
  QUIZ_RESPONSE_FORMAT,
} from "./quizPromptBuilder";
import {
  normalizeQuestion,
  normalizeStatement,
  parseGenerationContent,
  QuizGenerationError,
} from "./quizGenerationService";
import type { GeneratedQuestion } from "./quizGenerationService";
import type { QuizCreateInput } from "@/lib/api/schemas";

/**
 * Question source service.
 *
 * "database" questions come from a real, external question bank API
 * (OpenTDB-compatible) and carry `source = "database"` with honest provider
 * metadata. "web" questions are composed by the AI strictly from real,
 * recently fetched reference material and carry `source = "web"` plus the
 * consulted URLs. Nothing is invented or claimed from an unavailable source.
 */

/* ------------------------------------------------------------------
   External question-bank provider (database mode)
   ------------------------------------------------------------------ */

const OPENTDB_CATEGORY: Record<string, number> = {
  mathematics: 19,
  math: 19,
  physics: 17,
  chemistry: 17,
  biology: 17,
  "computer science": 18,
  history: 23,
  geography: 22,
  politics: 24,
  art: 25,
  mythology: 20,
  sports: 21,
  animals: 27,
  vehicles: 28,
  books: 10,
  literature: 10,
  film: 11,
  movies: 11,
  music: 12,
  television: 14,
  "video games": 15,
  general: 9,
};

const openTdbQuestionSchema = z
  .object({
    type: z.enum(["multiple", "boolean"]),
    difficulty: z.string(),
    category: z.string(),
    question: z.string(),
    correct_answer: z.string(),
    incorrect_answers: z.array(z.string()),
  })
  .loose();

const openTdbResponseSchema = z
  .object({
    response_code: z.number(),
    results: z.array(openTdbQuestionSchema),
  })
  .loose();

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rdquo: "\u201D",
  ldquo: "\u201C",
  rsquo: "\u2019",
  lsquo: "\u2018",
  eacute: "\u00E9",
  aacute: "\u00E1",
  euml: "\u00EB",
  uuml: "\u00FC",
  ouml: "\u00F6",
  auml: "\u00E4",
  szlig: "\u00DF",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  times: "\u00D7",
  divide: "\u00F7",
  plusmn: "\u00B1",
  deg: "\u00B0",
  sup2: "\u00B2",
  sup3: "\u00B3",
  egrave: "\u00E8",
  agrave: "\u00E0",
  ccedil: "\u00E7",
  atilde: "\u00E3",
  otilde: "\u00F5",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? entity : String.fromCodePoint(code);
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? entity : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[body] ?? entity;
  });
}

export function mapSubjectToCategory(subject: string): number {
  const key = subject.trim().toLowerCase();
  return OPENTDB_CATEGORY[key] ?? 9;
}

function topicMatches(topic: string, text: string): boolean {
  const keywords = topic
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
  if (keywords.length === 0) return true;
  const normalized = text.toLowerCase();
  return keywords.some((word) => normalized.includes(word));
}

/** Converts a raw OpenTDB row into our persisted question shape. */
export function toGeneratedQuestion(
  row: z.infer<typeof openTdbQuestionSchema>,
  config: QuizCreateInput
): GeneratedQuestion | null {
  const statement = decodeHtmlEntities(row.question).trim();
  if (statement.length < 3) return null;

  if (row.type === "boolean") {
    const answer = decodeHtmlEntities(row.correct_answer).trim().toLowerCase();
    if (answer !== "true" && answer !== "false") return null;
    return {
      statement,
      questionType: "true-false",
      options: [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ],
      correctAnswer: answer,
      explanation: null,
      difficulty: row.difficulty ?? config.difficulty,
      sourceMetadata: {
        provider: "opentdb",
        category: decodeHtmlEntities(row.category),
        type: row.type,
      },
      source: "database" as const,
      page: null,
    };
  }

  const options = [decodeHtmlEntities(row.correct_answer), ...row.incorrect_answers.map(decodeHtmlEntities)];
  if (options.some((option) => option.trim().length === 0)) return null;
  const letters = ["A", "B", "C", "D", "E", "F"];
  // Deterministic shuffle so the correct answer is not always position A.
  const shuffled = options
    .map((text, index) => ({ text: text.trim(), original: index }))
    .sort(() => Math.random() - 0.5);
  const mapped = shuffled.map((entry, index) => ({ id: letters[index], text: entry.text }));
  const correct = mapped.find((entry) => entry.text === decodeHtmlEntities(row.correct_answer).trim());
  if (!correct) return null;

  return {
    statement,
    questionType: "multiple-choice",
    options: mapped.map((entry) => ({ id: entry.id, label: entry.text })),
    correctAnswer: correct.id,
    explanation: null,
    difficulty: row.difficulty ?? config.difficulty,
    sourceMetadata: {
      provider: "opentdb",
      category: decodeHtmlEntities(row.category),
      type: row.type,
    },
    source: "database" as const,
    page: null,
  };
}

/**
 * Retrieves real questions from the external question bank. Filtered by
 * subject category, requested types and a topic keyword filter. The result
 * is capped by the caller's requested count.
 */
export async function fetchDatabaseQuestions(
  config: QuizCreateInput,
  count: number
): Promise<GeneratedQuestion[]> {
  const env = getEnv();
  assertSafeRemoteBaseUrl(env.QUESTION_DB_BASE_URL, "QUESTION_DB_BASE_URL");
  const category = mapSubjectToCategory(config.subject);
  const params = new URLSearchParams({
    amount: String(Math.min(50, Math.max(count * 3, count + 5))),
    category: String(category),
  });

  if (config.difficulty === "easy" || config.difficulty === "medium" || config.difficulty === "hard") {
    params.set("difficulty", config.difficulty);
  }
  if (config.questionType === "multiple-choice") params.set("type", "multiple");
  if (config.questionType === "true-false") params.set("type", "boolean");

  const url = `${env.QUESTION_DB_BASE_URL}/api.php?${params.toString()}`;
  let payload: unknown;
  try {
    // OpenTDB is rate-limited to ~1 request/5s/IP: on its explicit rate-limit
    // code we wait once and retry, instead of failing the quiz immediately.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(env.QUESTION_SOURCE_TIMEOUT_MS),
      });
      // OpenTDB enforces an IP rate limit; both 429 and response_code 5 occur.
      if (response.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5500));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Question bank answered ${response.status}.`);
      }
      payload = await response.json();
      const probe = openTdbResponseSchema.safeParse(payload);
      if (probe.success && probe.data.response_code === 5 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5500));
        continue;
      }
      break;
    }
  } catch (error) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "The question database is unavailable right now. Try again, or use the AI source.",
      { cause: error }
    );
  }

  const parsed = openTdbResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.response_code !== 0) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "The question database returned an unexpected response.",
      { cause: parsed.success ? `code ${parsed.data.response_code}` : undefined }
    );
  }

  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];
  for (const row of parsed.data.results) {
    const normalized = toGeneratedQuestion(row, config);
    if (!normalized) continue;
    if (config.topic && !topicMatches(config.topic, normalized.statement)) continue;
    const key = normalizeStatement(normalized.statement);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(normalized);
    if (questions.length >= count) break;
  }

  if (questions.length === 0) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "The question database had no questions for this subject/topic/difficulty combination. Try the AI or web source."
    );
  }

  return questions;
}

/* ------------------------------------------------------------------
   Real-time web research (web mode)
   ------------------------------------------------------------------ */

const wikiSearchSchema = z
  .object({
    query: z.object({
      search: z.array(z.object({ title: z.string(), snippet: z.string() }).loose()),
    }),
  })
  .loose();

const wikiExtractSchema = z
  .object({
    query: z.object({
      pages: z.record(
        z.string(),
        z
          .object({
            title: z.string().optional(),
            extract: z.string().optional(),
          })
          .loose()
      ),
    }),
  })
  .loose();

/**
 * Builds quiz questions strictly from fresh web material: Wikipedia search +
 * extract, then AIService grounds the questions in the retrieved text. The
 * consulted sources are kept as metadata so results can be cited honestly.
 */
export async function fetchWebResearchQuestions(
  config: QuizCreateInput,
  count: number
): Promise<GeneratedQuestion[]> {
  const env = getEnv();
  const query = [config.subject, config.topic].filter(Boolean).join(" ").trim();
  assertSafeRemoteBaseUrl(env.WEB_RESEARCH_BASE_URL, "WEB_RESEARCH_BASE_URL");
  const searchUrl = `${env.WEB_RESEARCH_BASE_URL}/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch=${encodeURIComponent(query)}`;

  let titles: string[] = [];
  try {
    const response = await fetch(searchUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(env.QUESTION_SOURCE_TIMEOUT_MS),
    });
    const parsed = wikiSearchSchema.safeParse(await response.json());
    if (parsed.success) {
      titles = parsed.data.query.search.map((hit) => hit.title).slice(0, 3);
    }
  } catch (error) {
    logger.warn("Web research search failed", { detail: String(error) });
  }

  if (titles.length === 0) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "No web sources were found for this topic right now. Try the AI or database source."
    );
  }

  const sources: Array<{ title: string; url: string; snippet: string }> = [];
  let extracts = "";
  try {
    const extractUrl = `${env.WEB_RESEARCH_BASE_URL}/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=${titles.map(encodeURIComponent).join("|")}`;
    const response = await fetch(extractUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(env.QUESTION_SOURCE_TIMEOUT_MS),
    });
    const parsed = wikiExtractSchema.safeParse(await response.json());
    if (parsed.success) {
      for (const page of Object.values(parsed.data.query.pages)) {
        if (!page.extract || !page.title) continue;
        const snippet = page.extract.slice(0, 1200);
        sources.push({
          title: page.title,
          url: `${env.WEB_RESEARCH_BASE_URL}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
          snippet: snippet.slice(0, 240),
        });
        extracts += `\n\n### ${page.title}\n${snippet}\n`;
      }
    }
  } catch (error) {
    logger.warn("Web research extract fetch failed", { detail: String(error) });
  }

  if (sources.length === 0 || extracts.trim().length === 0) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "Web sources were found but could not be read. Try the AI or database source."
    );
  }

  const env2 = getEnv();
  const collected: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let model: string | null = null;

  for (
    let attempt = 0;
    attempt < env2.QUIZ_GENERATION_MAX_ATTEMPTS && collected.length < count;
    attempt += 1
  ) {
    try {
      const result = await generate({
        messages: buildWebQuizMessages(config, { sources, extracts }, {
          questionCount: count - collected.length,
        }),
        temperature: 0.5,
        maxTokens: Math.min(16000, Math.max(2000, count * 500)),
        responseFormat: QUIZ_RESPONSE_FORMAT as never,
        signal: AbortSignal.timeout(env2.QUIZ_GENERATION_TIMEOUT_MS),
      });
      model = result.model ?? model;
      for (const raw of parseGenerationContent(result.content)) {
        const normalized = normalizeQuestion(raw);
        if (!normalized) continue;
        if (config.questionType !== "mixed" && normalized.questionType !== config.questionType) {
          continue;
        }
        const key = normalizeStatement(normalized.statement);
        if (key.length === 0 || seen.has(key)) continue;
        seen.add(key);
        normalized.difficulty = config.difficulty;
        normalized.sourceMetadata = { provider: "wikipedia", sources };
        normalized.source = "web";
        collected.push(normalized);
        if (collected.length >= count) break;
      }
    } catch (error) {
      if (error instanceof AIError) throw error;
      logger.warn("Web-grounded quiz generation attempt failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (collected.length < count) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      `Web research produced ${collected.length} of ${count} required valid questions. Try a broader topic, or use the AI or database source.`
    );
  }

  return collected.slice(0, count);
}
