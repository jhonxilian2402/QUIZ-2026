import type { QuizCreateInput } from "@/lib/api/schemas";
import type { AIMessage } from "../providers/types";

export type WebResearchContext = {
  /** Human-readable source list, surfaced honestly in the quiz metadata. */
  sources: Array<{ title: string; url: string; snippet: string }>;
  /** The actual retrieved text the questions must be grounded in. */
  extracts: string;
};

/**
 * Quiz prompt builder.
 *
 * Centralizes quiz-generation prompt construction so controllers and the
 * generation service never inline prompt text. The prompt mirrors the shared
 * contract the generator validates against.
 */

const DIFFICULTY_HINTS: Record<string, string> = {
  easy: "accessible recall-level questions for a beginner",
  medium: "standard comprehension-level questions",
  hard: "challenging questions that require reasoning or application",
  adaptive: "a spread of difficulties from straightforward to challenging",
};

const TYPE_INSTRUCTIONS: Record<string, string> = {
  "multiple-choice":
    'Every question must have type "multiple_choice" with exactly four options.',
  "true-false":
    'Every question must have type "true_false" with options for True and False.',
  mixed:
    'Use a mix of "multiple_choice" (four options) and "true_false" (True and False options).',
};

function resolveTopic(config: QuizCreateInput): string {
  const mode = config.configuration.contentMode;
  if (mode === "instructions") return config.configuration.customInstructions;
  return config.topic;
}

export function buildQuizMessages(
  config: QuizCreateInput,
  options: { questionCount: number; avoidStatements?: string[] }
): AIMessage[] {
  const topic = resolveTopic(config);
  const level = config.configuration.academicLevel || config.academicLevel;
  const difficultyHint =
    DIFFICULTY_HINTS[config.difficulty] ?? DIFFICULTY_HINTS.medium;
  const typeInstruction =
    TYPE_INSTRUCTIONS[config.questionType] ?? TYPE_INSTRUCTIONS["multiple-choice"];

  const avoid =
    options.avoidStatements && options.avoidStatements.length > 0
      ? `Do not repeat or paraphrase any of these already-generated statements:\n${options.avoidStatements
          .slice(0, 40)
          .map((statement) => `- ${statement}`)
          .join("\n")}\n`
      : "";

  const system = [
    "You are a careful educational assessment author.",
    "You write accurate, unambiguous quiz questions appropriate for the stated subject, level and difficulty.",
    "You never invent facts, never produce duplicate questions, and you always explain the correct answer.",
    "You answer with a single JSON object and no prose, markdown or code fences.",
  ].join(" ");

  const user = [
    `Write exactly ${options.questionCount} quiz question(s) for:`,
    `- Subject: ${config.subject}`,
    `- Topic/scope: ${topic}`,
    `- Academic level: ${level}`,
    `- Difficulty: ${config.difficulty} (${difficultyHint})`,
    `- Language: write the statement and options in the language matching locale "${config.configuration.language}".`,
    `- Question style: ${config.configuration.aiStyle}`,
    config.configuration.institution
      ? `- Institution context: ${config.configuration.institution}`
      : "",
    config.configuration.year ? `- Reference year/exam: ${config.configuration.year}` : "",
    config.configuration.customInstructions &&
    config.configuration.contentMode === "topic"
      ? `- Additional instructions: ${config.configuration.customInstructions}`
      : "",
    "",
    typeInstruction,
    "Rules:",
    "- Exactly one correct answer per question; distractors must be plausible.",
    "- Explanations must be concise (1-3 sentences), educational and specific to the question.",
    "- Statements must be self-contained and unambiguous.",
    avoid,
    "",
    "Return JSON with this exact shape:",
    JSON.stringify(
      {
        questions: [
          {
            type: "multiple_choice",
            statement: "...",
            options: [
              { id: "A", text: "..." },
              { id: "B", text: "..." },
              { id: "C", text: "..." },
              { id: "D", text: "..." },
            ],
            correctAnswer: "B",
            explanation: "...",
          },
          {
            type: "true_false",
            statement: "...",
            options: [
              { id: "true", text: "True" },
              { id: "false", text: "False" },
            ],
            correctAnswer: "false",
            explanation: "...",
          },
        ],
      },
      null,
      2
    ),
  ]
    .filter((line) => line !== "")
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildFileQuizMessages(
  config: QuizCreateInput,
  evidenceText: string
): AIMessage[] {
  const topic =
    config.configuration.contentMode === "instructions"
      ? config.configuration.customInstructions
      : config.topic;

  const system = [
    "You are a careful educational assessment author.",
    "You write accurate quiz questions grounded strictly in the provided document evidence.",
    "Never invent facts that are not supported by the material.",
    "You answer with a single JSON object and no prose, markdown or code fences.",
  ].join(" ");

  const user = [
    `Write exactly ${config.questionCount} quiz question(s) in language locale "${config.configuration.language}" covering "${topic || config.subject}" (subject: ${config.subject}, level: ${config.academicLevel}, difficulty: ${config.difficulty}).`,
    "Use ONLY the document evidence below. Every question's explanation should reference the document it came from.",
    "For each question include an optional \"page\" field: the page number from the === [filename · page N] === header of the evidence block you used, or null when the evidence has no page numbers. Never invent a page number.",
    "",
    evidenceText,
    "",
    'Every question must follow the JSON shape {type: "multiple_choice"|"true_false", statement, options:[{id,text}], correctAnswer, explanation, page}. Exactly one correct answer per question.',
    "",
    "Return JSON with this exact shape:",
    JSON.stringify(
      {
        questions: [
          {
            type: "multiple_choice",
            statement: "...",
            options: [
              { id: "A", text: "..." },
              { id: "B", text: "..." },
              { id: "C", text: "..." },
              { id: "D", text: "..." },
            ],
            correctAnswer: "B",
            explanation: "...",
            page: 12,
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildWebQuizMessages(
  config: QuizCreateInput,
  context: WebResearchContext,
  options: { questionCount: number }
): AIMessage[] {
  const topic =
    config.configuration.contentMode === "instructions"
      ? config.configuration.customInstructions
      : config.topic;

  const system = [
    "You are a careful educational assessment author.",
    "You write accurate quiz questions grounded strictly in the provided reference material.",
    "Never invent facts that are not supported by the material.",
    "You answer with a single JSON object and no prose, markdown or code fences.",
  ].join(" ");

  const user = [
    `Write exactly ${options.questionCount} quiz question(s) in language locale "${config.configuration.language}" about "${topic}" (subject: ${config.subject}, level: ${config.academicLevel}, difficulty: ${config.difficulty}).`,
    "Use ONLY the following real, retrieved web sources as ground truth. Every question's explanation must connect directly to a detail in the material.",
    "",
    context.extracts,
    "",
    'Every question must follow the JSON shape {type: "multiple_choice"|"true_false", statement, options:[{id,text}], correctAnswer, explanation}. Exactly one correct answer per question.',
    "",
    "Return JSON with this exact shape:",
    JSON.stringify(
      {
        questions: [
          {
            type: "multiple_choice",
            statement: "...",
            options: [
              { id: "A", text: "..." },
              { id: "B", text: "..." },
              { id: "C", text: "..." },
              { id: "D", text: "..." },
            ],
            correctAnswer: "B",
            explanation: "...",
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const QUIZ_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "quiz_questions",
    strict: false,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["multiple_choice", "true_false"] },
              statement: { type: "string" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["id", "text"],
                },
              },
              correctAnswer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["type", "statement", "options", "correctAnswer", "explanation"],
          },
        },
      },
      required: ["questions"],
    },
  },
} as const;
