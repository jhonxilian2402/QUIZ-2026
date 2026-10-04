import { AIError } from "../errors";
import { getEnv } from "../config/env";
import { logger } from "../logger";
import { getProvider } from "../providers/registry";
import { ensureBuiltinProviders } from "../providers/builtins";
import type { AICapability, AIModel } from "../providers/types";
import type {
  AIModelCatalogResponse,
  AIModelResponse,
  AIProviderStatusResponse,
} from "@/lib/api/contracts";

/**
 * Model catalog service.
 *
 * Owns the normalized model catalog: retrieval, caching with TTL, stale
 * fallback on provider failure, capability filtering, neutral sorting and
 * model availability validation. Nothing here exposes raw provider payloads.
 *
 * The catalog is global (models are not user-specific), so the cache lives on
 * globalThis to survive Next.js hot reloads without refetching.
 */

type CatalogCache = {
  models: AIModel[];
  fetchedAt: number;
  expiresAt: number;
  /** True when the last refresh failed and this snapshot is being reused. */
  stale: boolean;
};

type GlobalWithCatalog = typeof globalThis & {
  __quizModelCatalog?: CatalogCache;
  __quizModelCatalogFetch?: Promise<CatalogCache>;
};

const globalForCatalog = globalThis as GlobalWithCatalog;

const PROVIDER_ID = "openrouter" as const;

export type ModelFilters = {
  freeOnly?: boolean;
  vision?: boolean;
  streaming?: boolean;
  toolCalling?: boolean;
  structuredOutput?: boolean;
  minContext?: number;
};

export type ModelResolution = {
  /** The model that will actually be used. */
  model: AIModel;
  /** The model id the caller asked for ("" = automatic). */
  requestedModel: string;
  fallbackUsed: boolean;
};

function isConfigured(): boolean {
  return Boolean(getEnv().OPENROUTER_API_KEY);
}

function providerOrThrow() {
  ensureBuiltinProviders();
  const provider = getProvider(PROVIDER_ID);
  if (!provider) {
    throw new AIError("AI_PROVIDER_UNAVAILABLE", "No AI provider is registered.");
  }
  return provider;
}

/** Neutral, deterministic ordering: free first, then larger context, then name. */
function sortModels(models: AIModel[]): AIModel[] {
  return [...models].sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    const contextA = a.contextLength ?? -1;
    const contextB = b.contextLength ?? -1;
    if (contextA !== contextB) return contextB - contextA;
    return a.name.localeCompare(b.name);
  });
}

async function fetchCatalog(): Promise<CatalogCache> {
  const provider = providerOrThrow();
  const models = await provider.listModels();
  const env = getEnv();
  const now = Date.now();
  const cache: CatalogCache = {
    models,
    fetchedAt: now,
    expiresAt: now + env.AI_MODEL_CACHE_TTL_MS,
    stale: false,
  };
  globalForCatalog.__quizModelCatalog = cache;
  logger.info("Model catalog refreshed", {
    provider: PROVIDER_ID,
    modelCount: models.length,
    freeModelCount: models.filter((model) => model.isFree).length,
  });
  return cache;
}

/**
 * Returns the catalog, fetching when expired and serving the previous snapshot
 * when a refresh fails. Concurrent callers share one in-flight fetch.
 */
async function getCatalog(options: { refresh?: boolean } = {}): Promise<CatalogCache> {
  const cached = globalForCatalog.__quizModelCatalog;
  const fresh = cached && cached.expiresAt > Date.now();

  if (fresh && !options.refresh) return cached;

  if (!isConfigured()) {
    // Without a key there is no catalog at all; an existing snapshot would be
    // served even if stale, but never an invented one.
    if (cached) return { ...cached, stale: true };
    throw new AIError(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI provider is not configured on this server."
    );
  }

  if (!globalForCatalog.__quizModelCatalogFetch) {
    globalForCatalog.__quizModelCatalogFetch = fetchCatalog()
      .catch((error) => {
        if (cached) {
          logger.warn("Model catalog refresh failed; serving stale catalog", {
            provider: PROVIDER_ID,
            detail: error instanceof Error ? error.message : String(error),
          });
          return { ...cached, stale: true };
        }
        throw error;
      })
      .finally(() => {
        globalForCatalog.__quizModelCatalogFetch = undefined;
      });
  }
  return globalForCatalog.__quizModelCatalogFetch;
}

function toResponse(model: AIModel): AIModelResponse {
  return {
    id: model.id,
    provider: "openrouter",
    name: model.name,
    description: model.description,
    contextLength: model.contextLength,
    capabilities: model.capabilities,
    pricing: model.pricing,
    isFree: model.isFree,
    isAvailable: model.isAvailable,
  };
}

function matchesFilters(model: AIModel, filters: ModelFilters): boolean {
  if (filters.freeOnly && !model.isFree) return false;
  if (filters.vision && !model.capabilities.vision) return false;
  if (filters.streaming && !model.capabilities.streaming) return false;
  if (filters.toolCalling && !model.capabilities.toolCalling) return false;
  if (filters.structuredOutput && !model.capabilities.structuredOutput) return false;
  if (
    filters.minContext !== undefined &&
    (model.contextLength === null || model.contextLength < filters.minContext)
  ) {
    return false;
  }
  return true;
}

/** Public catalog view for the API. */
export async function listModels(
  filters: ModelFilters = {},
  options: { refresh?: boolean } = {}
): Promise<AIModelCatalogResponse> {
  const catalog = await getCatalog(options);
  const models = sortModels(
    catalog.models.filter((model) => model.isAvailable && matchesFilters(model, filters))
  );
  return {
    models: models.map(toResponse),
    updatedAt: new Date(catalog.fetchedAt).toISOString(),
    stale: catalog.stale,
  };
}

/** Forces revalidation, used by the explicit refresh endpoint. */
export async function refreshCatalog(): Promise<AIModelCatalogResponse> {
  return listModels({}, { refresh: true });
}

/** Provider status for the authenticated diagnostics endpoint. */
export async function providerStatus(): Promise<AIProviderStatusResponse> {
  const configured = isConfigured();
  if (!configured) {
    return {
      provider: PROVIDER_ID,
      configured: false,
      reachable: null,
      modelCount: null,
      freeModelCount: null,
      catalogUpdatedAt: null,
      catalogStale: null,
    };
  }

  try {
    const catalog = await getCatalog();
    return {
      provider: PROVIDER_ID,
      configured: true,
      reachable: !catalog.stale,
      modelCount: catalog.models.length,
      freeModelCount: catalog.models.filter((model) => model.isFree).length,
      catalogUpdatedAt: new Date(catalog.fetchedAt).toISOString(),
      catalogStale: catalog.stale,
    };
  } catch {
    return {
      provider: PROVIDER_ID,
      configured: true,
      reachable: false,
      modelCount: null,
      freeModelCount: null,
      catalogUpdatedAt: null,
      catalogStale: null,
    };
  }
}

/**
 * Validates that a model id can be used right now. Throws
 * AI_MODEL_UNAVAILABLE with a safe message otherwise.
 */
export async function assertModelUsable(
  modelId: string,
  requirements: Partial<Record<AICapability, true>> = {}
): Promise<AIModel> {
  const catalog = await getCatalog();
  const model = catalog.models.find((entry) => entry.id === modelId);

  if (!model || !model.isAvailable) {
    throw new AIError(
      "AI_MODEL_UNAVAILABLE",
      "The selected model is currently unavailable."
    );
  }
  for (const [capability, required] of Object.entries(requirements)) {
    if (required && !model.capabilities[capability as AICapability]) {
      throw new AIError(
        "AI_MODEL_UNAVAILABLE",
        "The selected model does not support a required capability."
      );
    }
  }
  return model;
}

/**
 * Resolves which model should serve a request.
 *
 * Order of preference (all catalog-verified):
 *   1. the explicitly requested model, when usable;
 *   2. the caller's configured fallback, when usable;
 *   3. the platform default (AI_DEFAULT_MODEL), when usable;
 *   4. the first compatible free model, in neutral catalog order.
 *
 * The resolution always reports which model was requested and whether a
 * fallback was used, so nothing ever claims the wrong model produced output.
 */
export async function resolveModel(options: {
  requestedModelId?: string | null;
  userFallbackModelId?: string | null;
  requirements?: Partial<Record<AICapability, true>>;
  /** When true, automatic selection only considers free models. */
  preferFree?: boolean;
  /** Models that must not be selected (e.g. one that just failed). */
  excludeModelIds?: string[];
}): Promise<ModelResolution> {
  const catalog = await getCatalog();
  const requirements = options.requirements ?? {};
  const excluded = new Set(options.excludeModelIds ?? []);

  const usable = (id: string | null | undefined): AIModel | null => {
    if (!id || excluded.has(id)) return null;
    const model = catalog.models.find((entry) => entry.id === id);
    if (!model || !model.isAvailable) return null;
    for (const [capability, required] of Object.entries(requirements)) {
      if (required && !model.capabilities[capability as AICapability]) return null;
    }
    return model;
  };

  const requested = options.requestedModelId ?? "";

  if (requested) {
    const model = usable(requested);
    if (model) return { model, requestedModel: requested, fallbackUsed: false };
  }

  const userFallback = usable(options.userFallbackModelId);
  if (userFallback) {
    return { model: userFallback, requestedModel: requested, fallbackUsed: true };
  }

  const platformDefault = usable(getEnv().AI_DEFAULT_MODEL);
  if (platformDefault) {
    return { model: platformDefault, requestedModel: requested, fallbackUsed: true };
  }

  // Automatic selection: the first compatible model in neutral order. Free
  // models are preferred unless the caller allows paid ones.
  const candidates = sortModels(
    catalog.models.filter(
      (model) =>
        model.isAvailable &&
        !excluded.has(model.id) &&
        (options.preferFree === false || model.isFree) &&
        Object.entries(requirements).every(
          ([capability, required]) =>
            !required || model.capabilities[capability as AICapability]
        )
    )
  );

  const model = candidates[0];
  if (!model) {
    throw new AIError(
      "AI_MODEL_UNAVAILABLE",
      "No compatible model is currently available."
    );
  }
  return { model, requestedModel: requested, fallbackUsed: requested.length > 0 };
}

/** Test helper: drops the cached catalog between suites. */
export function resetCatalogForTesting(): void {
  globalForCatalog.__quizModelCatalog = undefined;
  globalForCatalog.__quizModelCatalogFetch = undefined;
}
