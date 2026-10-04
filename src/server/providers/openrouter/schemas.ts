import { z } from "zod";

/**
 * Wire schemas for the OpenRouter API.
 *
 * External JSON is never trusted: every payload crosses one of these schemas
 * before it touches application logic. Unknown fields are ignored so additive
 * provider changes never break parsing; missing required shape is a controlled
 * AI_CONTENT_ERROR, not a crash.
 */

export const openRouterErrorBodySchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        code: z.union([z.string(), z.number()]).optional(),
      })
      .loose(),
  })
  .loose();

export const openRouterModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    context_length: z.number().int().positive().nullish(),
    architecture: z
      .object({
        input_modalities: z.array(z.string()).optional(),
        output_modalities: z.array(z.string()).optional(),
      })
      .loose()
      .optional(),
    pricing: z
      .object({
        prompt: z.string().optional(),
        completion: z.string().optional(),
      })
      .loose()
      .optional(),
    supported_parameters: z.array(z.string()).optional(),
  })
  .loose();

export const openRouterModelListSchema = z
  .object({
    data: z.array(openRouterModelSchema),
  })
  .loose();

/** GET /key — a cheap authenticated reachability probe. */
export const openRouterKeyInfoSchema = z
  .object({
    data: z.object({}).loose(),
  })
  .loose();

const openRouterUsageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative().nullish(),
    completion_tokens: z.number().int().nonnegative().nullish(),
    total_tokens: z.number().int().nonnegative().nullish(),
  })
  .loose();

const assistantContentSchema = z.union([
  z.string(),
  // Multimodal responses arrive as parts; only text parts are consumed.
  z.array(
    z
      .object({
        type: z.string(),
        text: z.string().optional(),
      })
      .loose()
  ),
]);

export const openRouterCompletionSchema = z
  .object({
    model: z.string().optional(),
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: assistantContentSchema.nullish(),
              })
              .loose()
              .optional(),
            finish_reason: z.string().nullish(),
          })
          .loose()
      )
      .optional(),
    usage: openRouterUsageSchema.optional(),
  })
  .loose();

export const openRouterStreamChunkSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            delta: z
              .object({
                content: z.string().nullish(),
              })
              .loose()
              .optional(),
            finish_reason: z.string().nullish(),
          })
          .loose()
      )
      .optional(),
    usage: openRouterUsageSchema.optional(),
    error: z
      .object({
        message: z.string().optional(),
        code: z.union([z.string(), z.number()]).optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;
export type OpenRouterUsage = z.infer<typeof openRouterUsageSchema>;
