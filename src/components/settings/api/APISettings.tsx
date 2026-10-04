"use client";

import { useState } from "react";
import { useSettings } from "../SettingsProvider";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from "../SettingsSection";
import { ResetSettingsDialog } from "../dialogs/ResetSettingsDialog";
import { ProviderCard } from "./ProviderCard";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/SelectField";
import { Slider } from "@/components/ui/Slider";
import {
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  PlugIcon,
  SearchIcon,
  SparkIcon,
  WarningIcon,
} from "@/components/ui/icons";
import { useModelCatalog } from "@/lib/api/useModelCatalog";
import { useQuery } from "@/lib/api/useQuery";
import { aiService, providerService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { INVALID } from "@/lib/constants";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./APISettings.module.css";

const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description:
      "Routes requests across many models through a single API key held in server configuration.",
    icon: <SparkIcon size={17} />,
  },
  {
    id: "web-search",
    name: "Web search",
    description:
      "Provides live web research for the Search section. A provider must be selected before any query can run.",
    icon: <SearchIcon size={17} />,
  },
  {
    id: "future",
    name: "Additional providers",
    description:
      "The provider card is reusable. New services appear here without a dedicated component.",
    icon: <PlugIcon size={17} />,
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

/**
 * API providers section. No credentials are collected or stored in this phase:
 * the key field is a local, masked draft that demonstrates the intended flow,
 * and every status is reported honestly as not configured.
 */
export function APISettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const api = settings.api;
  const dirty = dirtySections.includes("api");

  const [expanded, setExpanded] = useState<ProviderId | null>("openrouter");
  const [keyDraft, setKeyDraft] = useState("");
  const [revealed, setRevealed] = useState(false);

  const catalog = useModelCatalog({ freeOnly: true });

  const modelOptions: QuizOption<string>[] = catalog.models.map((model) => ({
    value: model.id,
    label: model.name,
    description: model.available ? model.contextLabel : "Unavailable",
  }));

  const status: { label: string; tone: StatusTone } = api.openRouterKeyConfigured
    ? { label: "Configured", tone: "accent" }
    : { label: "Not configured", tone: "muted" };

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.api}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Providers"
        description="Connection settings for model and search services."
      >
        {PROVIDERS.map((provider) => {
          const props =
            provider.id === "openrouter"
              ? {
                  statusLabel: status.label,
                  statusTone: status.tone,
                }
              : {
                  statusLabel: "Not connected",
                  statusTone: "muted" as StatusTone,
                };

          return (
            <div key={provider.id} className={styles.providerSlot}>
              <ProviderCard
                name={provider.name}
                description={provider.description}
                icon={provider.icon}
                statusLabel={props.statusLabel}
                statusTone={props.statusTone}
                onConfigure={
                  provider.id === "openrouter"
                    ? () =>
                        setExpanded((current) =>
                          current === provider.id ? null : provider.id
                        )
                    : undefined
                }
                configureLabel={provider.id === "openrouter" ? "Configure" : undefined}
                actionsDisabled={provider.id !== "openrouter"}
                expanded={expanded === provider.id}
                body={
                  provider.id === "openrouter" ? (
                    <OpenRouterPanel
                      keyDraft={keyDraft}
                      revealed={revealed}
                      onKeyDraftChange={setKeyDraft}
                      onToggleReveal={() => setRevealed((value) => !value)}
                      onClear={() => {
                        setKeyDraft("");
                        setRevealed(false);
                      }}
                    />
                  ) : (
                    <SettingsNote tone="neutral" icon={<WarningIcon size={14} />}>
                      This provider is not implemented yet. The card is a
                      placeholder in the shared provider system.
                    </SettingsNote>
                  )
                }
              />
            </div>
          );
        })}
      </SettingsGroup>

      <SettingsGroup
        title="Routing"
        description="Applied when OpenRouter is connected."
      >
        <SettingsRow
          title="Default model"
          description="Model used when a request is routed through OpenRouter."
          entryId="api.openRouterDefaultModelId"
          layout="stacked"
          control={
            <SelectField
              label="OpenRouter default model"
              placeholder="Not selected"
              options={modelOptions}
              value={api.openRouterDefaultModelId ?? ""}
              onChange={(value) =>
                update("api", {
                  openRouterDefaultModelId: value === "" ? null : value,
                })
              }
            />
          }
        />

        <SettingsRow
          title="Fallback model"
          description="Used when the default model is unavailable."
          entryId="api.openRouterFallbackModelId"
          layout="stacked"
          control={
            <SelectField
              label="OpenRouter fallback model"
              placeholder="No fallback"
              options={modelOptions}
              value={api.openRouterFallbackModelId ?? ""}
              onChange={(value) =>
                update("api", {
                  openRouterFallbackModelId: value === "" ? null : value,
                })
              }
            />
          }
        />

        <SettingsSwitchRow
          title="Prefer free models"
          description="Bias routing toward models that do not incur cost."
          checked={api.preferFreeModels}
          onChange={(preferFreeModels) => update("api", { preferFreeModels })}
          htmlFor="api-prefer-free"
          entryId="api.preferFreeModels"
        />

        <SettingsRow
          title="Request timeout"
          description="How long to wait before a request is abandoned."
          entryId="api.requestTimeoutSeconds"
          layout="stacked"
          control={
            <Slider
              label="Request timeout"
              min={10}
              max={180}
              step={5}
              value={api.requestTimeoutSeconds}
              onChange={(requestTimeoutSeconds) =>
                update("api", { requestTimeoutSeconds })
              }
              formatValue={(value) => `${value}s`}
              minLabel="10s"
              maxLabel="180s"
            />
          }
        />

        <SettingsSwitchRow
          title="Retry on failure"
          description="Automatically retry a failed request once."
          checked={api.retryOnFailure}
          onChange={(retryOnFailure) => update("api", { retryOnFailure })}
          htmlFor="api-retry"
          entryId="api.retryOnFailure"
        />
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="warning" icon={<WarningIcon size={14} />}>
          Never paste an API key into a chat message. Keys will be stored
          server-side once the connection is implemented, not in the browser.
        </SettingsNote>
        <ResetSettingsDialog target="api" label="Reset API settings" />
      </div>
    </SettingsSection>
  );
}

type OpenRouterPanelProps = {
  keyDraft: string;
  revealed: boolean;
  onKeyDraftChange: (value: string) => void;
  onToggleReveal: () => void;
  onClear: () => void;
};

function OpenRouterPanel({
  keyDraft,
  revealed,
  onKeyDraftChange,
  onToggleReveal,
  onClear,
}: OpenRouterPanelProps) {
  const invalid = keyDraft.length > 0 && !INVALID.API_KEY_SHAPE.test(keyDraft);

  const status = useQuery((signal) => aiService.providerStatus(signal), {
    key: "provider-status:openrouter",
  });
  const [testState, setTestState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "done"; ok: boolean; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const statusPill: { label: string; tone: StatusTone } = status.loading
    ? { label: "Checking…", tone: "muted" }
    : status.error || !status.data
      ? { label: "Unknown", tone: "muted" }
      : !status.data.configured
        ? { label: "Not configured", tone: "muted" }
        : status.data.reachable
          ? { label: "Connected", tone: "accent" }
          : { label: "Unavailable", tone: "warning" };

  const runTest = async () => {
    setTestState({ kind: "running" });
    try {
      const result = await providerService.test("openrouter");
      setTestState({ kind: "done", ok: result.ok, message: result.message });
      status.refetch();
    } catch (error) {
      setTestState({
        kind: "error",
        message: error instanceof ApiError ? error.message : "The test request failed.",
      });
    }
  };

  return (
    <div className={styles.panel}>
      <Field
        label="API key"
        hint="The platform key is configured on the server. Per-user keys arrive in a later phase; nothing typed here is transmitted or stored."
        error={invalid ? "That does not look like a valid key format." : undefined}
      >
        <Input
          type={revealed ? "text" : "password"}
          value={keyDraft}
          onChange={(event) => onKeyDraftChange(event.target.value)}
          placeholder="sk-or-…"
          autoComplete="off"
          spellCheck={false}
          invalid={invalid}
          aria-label="OpenRouter API key"
          trailing={
            <span className={styles.keyActions}>
              <button
                type="button"
                className={styles.keyAction}
                onClick={onToggleReveal}
                aria-label={revealed ? "Hide API key" : "Reveal API key"}
              >
                {revealed ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
              <button
                type="button"
                className={styles.keyAction}
                onClick={onClear}
                aria-label="Clear API key"
                disabled={keyDraft.length === 0}
              >
                <CloseIcon size={14} />
              </button>
            </span>
          }
        />
      </Field>

      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>Connection status</span>
        <StatusPill tone={statusPill.tone} dot>
          {statusPill.label}
        </StatusPill>
      </div>

      {testState.kind === "done" || testState.kind === "error" ? (
        <SettingsNote
          tone={testState.kind === "done" && testState.ok ? "accent" : "warning"}
          icon={<WarningIcon size={14} />}
        >
          {testState.message}
        </SettingsNote>
      ) : null}

      <div className={styles.panelActions}>
        <Button
          variant="subtle"
          size="sm"
          disabled
          title="Per-user keys arrive in a later phase"
        >
          Save key
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={runTest}
          disabled={testState.kind === "running"}
        >
          {testState.kind === "running" ? "Testing…" : "Test connection"}
        </Button>
      </div>

      <SettingsNote tone="neutral" icon={<WarningIcon size={14} />}>
        The test checks the platform key held in server configuration. No
        credential ever appears in responses, logs or the browser.
      </SettingsNote>
    </div>
  );
}