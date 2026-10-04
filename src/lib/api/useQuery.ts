"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isUnauthorized } from "./client";

/**
 * Minimal data-fetching hook.
 *
 * A dedicated library is unnecessary here: the application needs loading,
 * success, error and retry for a handful of resources. Requests are cancelled
 * when the component unmounts or the key changes, so navigating away never
 * leaves a request updating unmounted state.
 */

export type QueryState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True while a manual refetch runs, without clearing existing data. */
  refetching: boolean;
  refetch: () => void;
  setData: (updater: (current: T | null) => T | null) => void;
};

export function useQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: { key?: string; enabled?: boolean } = {}
): QueryState<T> {
  const { key = "default", enabled = true } = options;

  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refetching, setRefetching] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [nonce, setNonce] = useState(0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    if (isFirstRun.current) setLoading(true);
    else setRefetching(true);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        setDataState(result);
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        // A cancellation is expected on unmount or key change.
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof ApiError ? cause : null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefetching(false);
        isFirstRun.current = false;
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, enabled, nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  const setData = useCallback(
    (updater: (current: T | null) => T | null) => setDataState((current) => updater(current)),
    []
  );

  return { data, error, loading, refetching, refetch, setData };
}

export { isUnauthorized };