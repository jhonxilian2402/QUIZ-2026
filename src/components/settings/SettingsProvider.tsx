"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS } from "@/lib/settingsDefaults";
import { settingsService } from "@/lib/api/services";
import { ApiError, isUnauthorized } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import type { AppearanceSettings, UserSettings } from "@/types";

/** Which slice a reset targets, or every slice. */
export type ResetTarget = keyof UserSettings | "all";

export type SettingsSectionKey = keyof UserSettings;

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Status of the settings store, so the shell can render honest states. */
export type StoreStatus = "loading" | "ready" | "unauthenticated" | "error";

type SettingsContextValue = {
  settings: UserSettings;
  saved: UserSettings;
  dirty: boolean;
  dirtySections: SettingsSectionKey[];
  update: <K extends keyof UserSettings>(
    section: K,
    patch: Partial<UserSettings[K]>
  ) => void;
  replaceSection: <K extends keyof UserSettings>(
    section: K,
    value: UserSettings[K]
  ) => void;
  save: () => void;
  discard: () => void;
  reset: (target: ResetTarget) => void;
  saveState: SaveState;
  saveError: string | null;
  /** True once a real save endpoint exists (it does, from this phase on). */
  persistenceConnected: boolean;
  status: StoreStatus;
  reload: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}

const SECTIONS = Object.keys(DEFAULT_SETTINGS) as SettingsSectionKey[];

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof T>;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function resolveTheme(theme: AppearanceSettings["theme"]): "dark" | "light" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * Owns the settings draft and applies the appearance layers to the document.
 *
 * Settings now persist through the API: values load on mount, and Save sends
 * only the changed sections. Appearance continues to apply live from the draft,
 * so the shell previews changes before they are committed.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();

  const [saved, setSaved] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [nonce, setNonce] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the persisted document once, and again whenever a reload is requested.
  useEffect(() => {
    const controller = new AbortController();
    setStatus((current) => (current === "ready" ? "ready" : "loading"));

    settingsService
      .get(controller.signal)
      .then((loaded) => {
        if (!mountedRef.current) return;
        setSaved(loaded);
        setDraft(loaded);
        setStatus("ready");
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!mountedRef.current) return;
        // Not being signed in is an expected state, not a failure: an
        // anonymous visitor still gets the application with local defaults.
        if (isUnauthorized(error)) {
          setStatus("unauthenticated");
          return;
        }
        setStatus("error");
      });

    return () => controller.abort();
  }, [nonce]);

  const update = useCallback(
    <K extends keyof UserSettings>(section: K, patch: Partial<UserSettings[K]>) => {
      setDraft((current) => ({
        ...current,
        [section]: { ...current[section], ...patch },
      }));
      setSaveState("idle");
      setSaveError(null);
    },
    []
  );

  const replaceSection = useCallback(
    <K extends keyof UserSettings>(section: K, value: UserSettings[K]) => {
      setDraft((current) => ({ ...current, [section]: value }));
      setSaveState("idle");
      setSaveError(null);
    },
    []
  );

  const dirtySections = useMemo(
    () => SECTIONS.filter((section) => !shallowEqual(draft[section], saved[section])),
    [draft, saved]
  );
  const dirty = dirtySections.length > 0;

  /**
   * Sends only the sections that differ. A real request runs here, so the
   * resulting state reflects the server's response rather than an assumption.
   */
  const save = useCallback(() => {
    const changes = dirtySections;
    if (changes.length === 0) return;

    if (status !== "ready") {
      // Without a session there is no server document to update. The UI states
      // this plainly instead of pretending the change was stored.
      notify({
        tone: "warning",
        title: "Not signed in",
        description: "Sign in to store preferences on your account.",
      });
      return;
    }

    const patch = Object.fromEntries(
      changes.map((section) => [section, draft[section]])
    ) as Partial<UserSettings>;

    setSaveState("saving");
    setSaveError(null);

    settingsService
      .update(patch)
      .then((updated) => {
        if (!mountedRef.current) return;
        setSaved(updated);
        setDraft(updated);
        setSaveState("saved");
        notify({ tone: "success", title: "Preferences saved" });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return;
        const message =
          error instanceof ApiError ? error.message : "Could not save preferences.";
        setSaveState("error");
        setSaveError(message);
        notify({ tone: "error", title: "Could not save preferences", description: message });
      });
  }, [dirtySections, draft, notify, status]);

  const discard = useCallback(() => {
    setDraft(saved);
    setSaveState("idle");
    setSaveError(null);
  }, [saved]);

  const reset = useCallback(
    (target: ResetTarget) => {
      if (target === "all") {
        setDraft(DEFAULT_SETTINGS);
        setSaved(DEFAULT_SETTINGS);
      } else {
        setDraft((current) => ({ ...current, [target]: DEFAULT_SETTINGS[target] }));
        setSaved((current) => ({ ...current, [target]: DEFAULT_SETTINGS[target] }));
      }
      setSaveState("idle");
      setSaveError(null);
    },
    []
  );

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // Apply the five appearance layers to <html> as data attributes so the token
  // overrides in tokens.css reach the shared shell.
  const appearance = draft.appearance;
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolveTheme(appearance.theme);
      root.dataset.density = appearance.density;
      root.dataset.motion = appearance.motion;
      root.dataset.fontScale = appearance.fontScale;
      root.dataset.accent = appearance.accent;
      root.dataset.contrast = appearance.highContrast ? "high" : "normal";
      root.dataset.transparency = appearance.reduceTransparency
        ? "reduced"
        : "full";
    };
    apply();

    if (appearance.theme !== "system" || typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [appearance]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: draft,
      saved,
      dirty,
      dirtySections,
      update,
      replaceSection,
      save,
      discard,
      reset,
      saveState,
      saveError,
      persistenceConnected: status === "ready",
      status,
      reload,
    }),
    [
      draft,
      saved,
      dirty,
      dirtySections,
      update,
      replaceSection,
      save,
      discard,
      reset,
      saveState,
      saveError,
      status,
      reload,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}