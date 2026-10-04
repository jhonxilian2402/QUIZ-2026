"use client";

import { useMemo } from "react";
import { aiService } from "./services";
import { useQuery } from "./useQuery";
import { toModelInfo } from "@/lib/modelCatalogue";
import type { AIModelCatalogResponse } from "./contracts";
import type { ModelInfo } from "@/types";
import type { ApiError } from "./client";

/**
 * Shared access to the live model catalog for settings surfaces.
 *
 * The server caches the provider catalog, so each section can ask for it
 * independently without triggering redundant upstream requests. The hook
 * exposes honest loading, error and empty states — never placeholder models.
 */
export type ModelCatalogState = {
  /** Display-ready models, already mapped and server-sorted. */
  models: ModelInfo[];
  catalog: AIModelCatalogResponse | null;
  loading: boolean;
  refetching: boolean;
  error: ApiError | null;
  /** True when the provider is unreachable and no catalog could be served. */
  unavailable: boolean;
  refetch: () => void;
};

export function useModelCatalog(options: { freeOnly?: boolean } = {}): ModelCatalogState {
  const freeOnly = options.freeOnly ?? false;
  const query = useQuery<AIModelCatalogResponse>(
    (signal) => aiService.models({ freeOnly }, signal),
    { key: `models:${freeOnly ? "free" : "all"}` }
  );

  const models = useMemo(
    () => (query.data?.models ?? []).map(toModelInfo),
    [query.data]
  );

  return {
    models,
    catalog: query.data,
    loading: query.loading,
    refetching: query.refetching,
    error: query.error,
    unavailable: query.error !== null,
    refetch: query.refetch,
  };
}
