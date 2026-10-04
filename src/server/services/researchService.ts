/**
 * Web research service boundary.
 *
 * Defines what a future research implementation must provide. No search is
 * performed in this phase and no provider is registered, so callers receive an
 * explicit "not connected" result rather than fabricated sources.
 */

export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export type ResearchResult = {
  query: string;
  sources: ResearchSource[];
};

export interface ResearchProvider {
  readonly id: string;
  search(query: string, options: { limit: number }): Promise<ResearchResult>;
}

const providers = new Map<string, ResearchProvider>();

export function registerResearchProvider(provider: ResearchProvider): void {
  providers.set(provider.id, provider);
}

export function listResearchProviders(): string[] {
  return [...providers.keys()];
}

export function isResearchConnected(): boolean {
  return providers.size > 0;
}

/**
 * Runs a research query through the first registered provider.
 *
 * Throws when nothing is registered, so no caller can mistake an empty result
 * for a completed search.
 */
export async function research(
  query: string,
  options: { limit: number }
): Promise<ResearchResult> {
  const provider = [...providers.values()][0];
  if (!provider) {
    throw new NotConnectedError();
  }
  return provider.search(query, options);
}

export class NotConnectedError extends Error {
  readonly code = "PROVIDER_ERROR" as const;
  constructor() {
    super(
      "Web research is not connected yet. A search provider will be configured in a later phase."
    );
    this.name = "ResearchNotConnectedError";
  }
}

export const researchStatus = {
  connected: false,
  reason: "No search provider is registered.",
} as const;