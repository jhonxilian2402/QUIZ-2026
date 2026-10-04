import { getEnv } from "../config/env";
import { AIError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import {
  deleteFailedAssistantMessagesAfter,
  findCompletedAssistantReplyAfter,
  findConversationForUser,
  findMessageByClientRequestId,
  insertMessage,
  listRecentMessagesForContext,
  toConversationResponse,
  toMessageResponse,
  touchConversation,
  updateConversationForUser,
} from "../repositories/conversationRepository";
import { getSettingsOrDefaults } from "../repositories/settingsRepository";
import { resolveModel } from "./modelCatalogService";
import { buildSystemPrompt } from "./systemPromptService";
import * as aiService from "./aiService";
import { deriveTitle } from "@/lib/titles";
import type { ChatMessageInput } from "@/lib/api/schemas";
import type { AIMessage } from "../providers/types";
import type {
  ChatStreamEvent,
  ConversationResponse,
  MessageResponse,
  UserSettings,
} from "@/lib/api/contracts";

/**
 * Chat service.
 *
 * Runs one complete chat turn behind the API: ownership, validation,
 * idempotency, user-message persistence, context selection, model resolution,
 * real streamed generation and assistant-message persistence. The route layer
 * only serializes these events as SSE; the frontend only consumes them.
 *
 * Ordering guarantees:
 *   - the user message is persisted before any provider call, so provider
 *     failure never loses user input;
 *   - no database transaction stays open during streaming;
 *   - the assistant message is written exactly once, complete or marked
 *     failed/cancelled with its partial content.
 */

/* ------------------------------------------------------------------
   Per-conversation generation lock
   A conversation supports one active generation; concurrent sends are
   rejected deterministically instead of corrupting the transcript.
   ------------------------------------------------------------------ */

const globalForChat = globalThis as typeof globalThis & {
  __quizChatLocks?: Map<string, true>;
};

function locks(): Map<string, true> {
  globalForChat.__quizChatLocks ??= new Map();
  return globalForChat.__quizChatLocks;
}

/** Test helper: clears generation locks between suites. */
export function resetChatLocksForTesting(): void {
  globalForChat.__quizChatLocks = undefined;
}

/* ------------------------------------------------------------------
   Context selection
   ------------------------------------------------------------------ */

/** Rough token estimate: ~4 characters per token for mixed prose/code. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Selects the messages sent to the provider. The system prompt and the newest
 * messages always survive; older turns are dropped first when the budget is
 * exceeded. Only the brand-new user message can push the budget over the edge
 * on its own, and that is reported as AI_CONTEXT_TOO_LARGE.
 */
export function selectContext(options: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  tokenBudget: number;
}): AIMessage[] {
  const system: AIMessage = { role: "system", content: options.systemPrompt };
  const systemTokens = estimateTokens(options.systemPrompt);

  const selected: typeof options.history = [];
  let used = systemTokens;

  for (let index = options.history.length - 1; index >= 0; index--) {
    const message = options.history[index];
    const cost = estimateTokens(message.content) + 4;
    if (used + cost > options.tokenBudget && selected.length > 0) break;
    if (used + cost > options.tokenBudget) {
      // Even the newest message alone exceeds the budget.
      throw new AIError(
        "AI_CONTEXT_TOO_LARGE",
        "This conversation is too large for the current context. Start a new conversation."
      );
    }
    used += cost;
    selected.unshift(message);
  }

  return [system, ...selected.map((message) => ({ role: message.role, content: message.content }))];
}

/* ------------------------------------------------------------------
   Settings → generation parameters
   ------------------------------------------------------------------ */

function temperatureFromCreativity(creativity: number): number {
  // 0–100 slider mapped onto the common 0–2 temperature range.
  return Math.round((creativity / 50) * 10) / 10;
}

function maxTokensFromPreference(preference: UserSettings["ai"]["maxResponseLength"]): number | undefined {
  switch (preference) {
    case "short":
      return 512;
    case "medium":
      return 1024;
    case "long":
      return 2048;
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------
   The chat turn
   ------------------------------------------------------------------ */

export type RunChatTurnOptions = {
  userId: string;
  conversationId: string;
  input: ChatMessageInput;
  /** Aborted when the client disconnects (navigation, Stop button). */
  signal?: AbortSignal;
  requestId?: string;
};

export async function* runChatTurn(
  options: RunChatTurnOptions
): AsyncGenerator<ChatStreamEvent> {
  const { userId, conversationId, input, signal } = options;
  const env = getEnv();

  const conversation = await findConversationForUser(conversationId, userId);
  if (!conversation) throw new NotFoundError("Conversation not found.");
  if (conversation.archivedAt) {
    throw new ValidationError("This conversation is archived.");
  }

  const content = input.content.trim();
  if (content.length === 0) {
    throw new ValidationError("The message must not be empty.", {
      details: { content: ["The message must not be empty."] },
    });
  }
  if (content.length > env.AI_MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `Messages are limited to ${env.AI_MAX_MESSAGE_LENGTH} characters.`,
      { details: { content: [`Keep it under ${env.AI_MAX_MESSAGE_LENGTH} characters.`] } }
    );
  }

  if (locks().has(conversationId)) {
    throw new ConflictError(
      "A response is already being generated for this conversation."
    );
  }
  locks().set(conversationId, true);

  try {
    /* ---------------- 1. Persist or reconcile the user message -------- */

    let userMessageRow: Awaited<ReturnType<typeof insertMessage>> | null = null;
    let isRetry = false;

    if (input.clientRequestId) {
      const existing = await findMessageByClientRequestId(
        conversationId,
        input.clientRequestId
      );
      if (existing) {
        userMessageRow = existing;
        isRetry = true;

        // A completed reply already exists: replay it instead of generating
        // a second answer for the same logical send.
        const reply = await findCompletedAssistantReplyAfter(
          conversationId,
          existing.createdAt
        );
        if (reply) {
          yield {
            type: "complete",
            conversation: toConversationResponse(conversation),
            assistantMessage: toMessageResponse(reply),
          };
          return;
        }

        // Only failed/cancelled attempts exist: clear them so the transcript
        // holds exactly one assistant message for this turn after retry.
        await deleteFailedAssistantMessagesAfter(conversationId, existing.createdAt);
      }
    }

    if (!userMessageRow) {
      userMessageRow = await insertMessage({
        conversationId,
        role: "user",
        content,
        metadata: {
          ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
          ...(input.attachments && input.attachments.length > 0
            ? { attachments: input.attachments }
            : {}),
        },
      });
    }
    const userMessage = toMessageResponse(userMessageRow);

    const settings = await getSettingsOrDefaults(userId);

    /* ---------------- 1b. File attachments → evidence context -------------- */
    let fileEvidenceBlock = "";
    let fileCitations: Array<{ fileId: string; filename: string; page: number | null }> = [];
    if (input.attachments && input.attachments.length > 0) {
      const { buildEvidence } = await import("./fileContextService");
      const evidence = await buildEvidence({
        userId,
        fileIds: input.attachments,
        query: content,
      });
      if (!evidence.empty) {
        fileEvidenceBlock = evidence.text;
        fileCitations = evidence.citations;
      }
    }

    /* ---------------- 2. Resolve the model ---------------- */

    const requestedModelId =
      input.model ?? conversation.model ?? settings.ai.defaultModelId ?? "";

    const resolution = await resolveModel({
      requestedModelId: requestedModelId || null,
      userFallbackModelId: settings.ai.fallbackModelId,
      requirements: { text: true },
      preferFree: settings.api.preferFreeModels,
    });

    /* ---------------- 3. Build the provider context ---------------- */

    const historyRows = await listRecentMessagesForContext(conversationId, 60);
    const baseSystemPrompt = buildSystemPrompt({
      responseStyle: settings.ai.responseStyle,
    });
    const systemPrompt =
      fileEvidenceBlock.length > 0
        ? `${baseSystemPrompt}\n\n${fileEvidenceBlock}`
        : baseSystemPrompt;
    const modelBudget =
      resolution.model.contextLength !== null
        ? Math.floor(resolution.model.contextLength * 0.6)
        : null;
    const tokenBudget = Math.min(
      env.AI_CONTEXT_TOKEN_BUDGET,
      modelBudget ?? env.AI_CONTEXT_TOKEN_BUDGET
    );

    const messages = selectContext({
      systemPrompt,
      history: historyRows
        .filter((row) => row.role === "user" || row.role === "assistant")
        .map((row) => ({ role: row.role as "user" | "assistant", content: row.content })),
      tokenBudget,
    });

    /* ---------------- 4. Generate, streaming ---------------- */

    const startedAt = Date.now();
    let assistantContent = "";
    let usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null = null;
    let actualModel = resolution.model.id;
    let fallbackUsed = resolution.fallbackUsed;
    let streamStarted = false;

    const metadataBase = {
      provider: "openrouter",
      requestedModel: resolution.requestedModel || resolution.model.id,
      ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
    };

    /** Persists the final assistant state exactly once. */
    const persistAssistant = async (
      status: "completed" | "failed" | "cancelled"
    ): Promise<MessageResponse | null> => {
      if (assistantContent.trim().length === 0 && status !== "completed") {
        // Nothing worth preserving: the turn simply has no assistant message.
        return null;
      }
      const row = await insertMessage({
        conversationId,
        role: "assistant",
        content: assistantContent,
        metadata: {
          ...metadataBase,
          model: actualModel,
          fallbackUsed,
          tokens: usage
            ? {
                prompt: usage.promptTokens ?? 0,
                completion: usage.completionTokens ?? 0,
              }
            : null,
          durationMs: Date.now() - startedAt,
          status,
          ...(status === "completed" ? {} : { partial: true }),
          ...(fileCitations.length > 0 ? { fileCitations } : {}),
        },
      });
      await touchConversation(conversationId);
      return toMessageResponse(row);
    };

    /** Auto-title the conversation from the first user message. */
    const finalizeConversation = async (): Promise<ConversationResponse> => {
      if (conversation.title === "New conversation") {
        const titled = await updateConversationForUser(conversationId, userId, {
          title: deriveTitle(content),
        });
        if (titled) return toConversationResponse(titled);
      }
      await touchConversation(conversationId);
      return toConversationResponse({
        ...conversation,
        updatedAt: new Date(),
      });
    };

    try {
      const streamOptions = {
        requestedModelId: resolution.model.id,
        userFallbackModelId: settings.ai.fallbackModelId,
        preferFree: settings.api.preferFreeModels,
        requirements: { text: true } as const,
        messages,
        temperature: temperatureFromCreativity(settings.ai.creativity),
        maxTokens: maxTokensFromPreference(settings.ai.maxResponseLength),
        signal,
        requestId: options.requestId,
      };

      if (settings.ai.streaming) {
        for await (const event of aiService.stream(streamOptions)) {
          if (event.type === "start") {
            streamStarted = true;
            actualModel = event.model;
            fallbackUsed = fallbackUsed || event.fallbackUsed || event.model !== resolution.model.id;
            yield {
              type: "start",
              conversationId,
              userMessage,
              model: actualModel,
              requestedModel: resolution.requestedModel || actualModel,
              fallbackUsed,
            };
          } else if (event.type === "delta") {
            assistantContent += event.content;
            yield { type: "delta", content: event.content };
          } else if (event.type === "usage") {
            usage = event.usage;
            yield { type: "usage", usage: event.usage };
          } else if (event.type === "error") {
            throw new AIError(
              (event.code as AIError["aiCode"]) ?? "AI_PROVIDER_UNAVAILABLE",
              event.message
            );
          }
        }
      } else {
        // Streaming disabled in settings: one buffered completion delivered
        // through the same event contract.
        streamStarted = true;
        yield {
          type: "start",
          conversationId,
          userMessage,
          model: actualModel,
          requestedModel: resolution.requestedModel || actualModel,
          fallbackUsed,
        };
        const result = await aiService.generate(streamOptions);
        actualModel = result.model;
        fallbackUsed = fallbackUsed || result.fallbackUsed;
        assistantContent = result.content;
        usage = result.usage;
        yield { type: "delta", content: result.content };
        if (result.usage) yield { type: "usage", usage: result.usage };
      }

      /* ---------------- 5. Persist the completed turn ---------------- */

      const assistantMessage = await persistAssistant("completed");
      if (!assistantMessage) {
        throw new AIError(
          "AI_CONTENT_ERROR",
          "The AI provider returned an empty response.",
          { expose: true }
        );
      }
      const conversationResponse = await finalizeConversation();

      logger.info("Chat turn completed", {
        userId,
        route: "chat",
        requestedModel: metadataBase.requestedModel,
        model: actualModel,
        fallbackUsed,
        durationMs: Date.now() - startedAt,
        tokens: usage?.totalTokens ?? null,
        retried: isRetry,
      });

      yield {
        type: "complete",
        conversation: conversationResponse,
        assistantMessage,
      };
    } catch (error) {
      const cancelled =
        signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError");

      const assistantMessage = await persistAssistant(cancelled ? "cancelled" : "failed");
      await touchConversation(conversationId);

      if (cancelled) {
        logger.info("Chat turn cancelled", {
          userId,
          route: "chat",
          model: actualModel,
          partial: assistantMessage !== null,
        });
        // The client that aborted is usually gone; the event matters for
        // explicit Stop, which still reads the stream tail.
        yield {
          type: "error",
          code: "AI_UNKNOWN_ERROR",
          message: "Generation stopped.",
          userMessage,
          assistantMessage,
        };
        return;
      }

      const normalized =
        error instanceof AIError
          ? error
          : new AIError("AI_UNKNOWN_ERROR", "The response could not be generated.", {
              expose: false,
              cause: error,
            });

      logger.warn("Chat turn failed", {
        userId,
        route: "chat",
        errorCategory: normalized.code,
        model: actualModel,
        streamStarted,
        partial: assistantMessage !== null,
      });

      yield {
        type: "error",
        code: normalized.code,
        message: normalized.expose
          ? normalized.message
          : "The AI service could not answer. Please try again.",
        userMessage,
        assistantMessage,
      };
    }
  } finally {
    locks().delete(conversationId);
  }
}
