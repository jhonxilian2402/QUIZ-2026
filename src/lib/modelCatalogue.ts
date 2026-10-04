import type { AIModelResponse } from "@/lib/api/contracts";
import type { ModelCapability, ModelInfo } from "@/types";

/**
 * Maps the normalized API model onto the display shape the settings components
 * already render. There is no static catalogue: every row originates from the
 * live provider catalog served by /api/ai/models.
 */
export function toModelInfo(model: AIModelResponse): ModelInfo {
  const capabilities: ModelCapability[] = [];
  if (model.capabilities.text) capabilities.push("text");
  if (model.capabilities.vision) capabilities.push("vision");
  if (model.capabilities.fileInput) capabilities.push("files");
  if (model.capabilities.toolCalling) capabilities.push("tools");

  return {
    id: model.id,
    name: model.name,
    provider: "OpenRouter",
    tier: model.isFree ? "free" : "paid",
    contextLabel:
      model.contextLength === null
        ? "Not reported"
        : model.contextLength >= 1000
          ? `${Math.round(model.contextLength / 1000)}k tokens`
          : `${model.contextLength} tokens`,
    capabilities,
    available: model.isAvailable,
  };
}

export const CAPABILITY_LABELS: Record<
  ModelInfo["capabilities"][number],
  string
> = {
  text: "Text",
  vision: "Vision",
  files: "Files",
  tools: "Tools",
  web: "Web",
};
