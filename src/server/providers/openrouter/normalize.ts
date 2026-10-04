import type { AIModel, AIUsage } from "../types";
import type { OpenRouterModel, OpenRouterUsage } from "./schemas";

/**
 * OpenRouter → normalized model conversion.
 *
 * Free status is derived from the provider's current pricing fields — never
 * from naming conventions such as a ":free" suffix, which can change. When
 * pricing is absent the model is treated as paid, because "unknown" must not
 * silently become "free".
 */

function parsePrice(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectFree(
  pricing: OpenRouterModel["pricing"]
): { isFree: boolean; input: number | null; output: number | null } {
  const input = parsePrice(pricing?.prompt);
  const output = parsePrice(pricing?.completion);
  return {
    // Both directions must be reported and zero. Anything else is not free.
    isFree: input === 0 && output === 0,
    input,
    output,
  };
}

export function normalizeModel(raw: OpenRouterModel): AIModel {
  const inputs = raw.architecture?.input_modalities ?? [];
  const outputs = raw.architecture?.output_modalities ?? [];
  const parameters = raw.supported_parameters ?? [];
  const pricing = detectFree(raw.pricing);

  return {
    id: raw.id,
    provider: "openrouter",
    name: raw.name,
    description: raw.description ?? null,
    contextLength:
      typeof raw.context_length === "number" ? raw.context_length : null,
    capabilities: {
      // When modalities are not reported, text is assumed (the catalog lists
      // chat-completion models) and everything else is reported as unsupported.
      text: outputs.length === 0 || outputs.includes("text"),
      vision: inputs.includes("image"),
      imageInput: inputs.includes("image"),
      fileInput: inputs.includes("file"),
      streaming: true,
      toolCalling: parameters.includes("tools"),
      structuredOutput:
        parameters.includes("structured_outputs") ||
        parameters.includes("response_format"),
    },
    pricing: { input: pricing.input, output: pricing.output },
    isFree: pricing.isFree,
    // Models returned by the catalog endpoint are currently servable.
    isAvailable: true,
  };
}

export function normalizeUsage(
  raw: OpenRouterUsage | undefined
): AIUsage | null {
  if (!raw) return null;
  const usage: AIUsage = {
    promptTokens: raw.prompt_tokens ?? null,
    completionTokens: raw.completion_tokens ?? null,
    totalTokens: raw.total_tokens ?? null,
  };
  // A wholly empty usage object is reported as "not provided".
  if (
    usage.promptTokens === null &&
    usage.completionTokens === null &&
    usage.totalTokens === null
  ) {
    return null;
  }
  return usage;
}
