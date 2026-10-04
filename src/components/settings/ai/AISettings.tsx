"use client";

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
import { ModelPreferenceRow } from "./ModelPreferenceRow";
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { InfoIcon, WarningIcon } from "@/components/ui/icons";
import { useModelCatalog } from "@/lib/api/useModelCatalog";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./AISettings.module.css";

const STYLE_OPTIONS: QuizOption<"concise" | "balanced" | "detailed">[] = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

const LENGTH_OPTIONS: QuizOption<"short" | "medium" | "long" | "provider">[] = [
  { value: "provider", label: "Provider default" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

const CONTEXT_OPTIONS: QuizOption<"retain" | "summarize" | "reset">[] = [
  { value: "retain", label: "Retain" },
  { value: "summarize", label: "Summarize" },
  { value: "reset", label: "Reset each turn" },
];

const REASONING_OPTIONS: QuizOption<
  "auto" | "off" | "low" | "medium" | "high"
>[] = [
  { value: "auto", label: "Automatic" },
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** Stored sentinels that mean "automatic selection". */
function isAutomatic(value: string | null): boolean {
  return value === null || value === "" || value === "assistant";
}

/**
 * AI section. Model rows render the live provider catalog served by the
 * application API: loading, failure and empty states are shown honestly, and
 * no model is ever invented client-side.
 */
export function AISettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const ai = settings.ai;
  const dirty = dirtySections.includes("ai");

  // The platform runs on free models initially, so the catalogue view and the
  // selection lists are scoped to what currently costs nothing.
  const catalog = useModelCatalog({ freeOnly: true });

  const modelOptions: QuizOption<string>[] = [
    { value: "", label: "Automatic", description: "Resolved from the live catalog." },
    ...catalog.models.map((model) => ({
      value: model.id,
      label: model.name,
      description: model.available ? model.contextLabel : "Unavailable",
    })),
  ];

  const selectedDefault = isAutomatic(ai.defaultModelId) ? "" : ai.defaultModelId;

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.ai}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Models"
        description="Live catalog served by the application API. Selection persists on your account."
      >
        <SettingsRow
          title="Default model"
          description="Primary model for generation across Chat and Quiz."
          entryId="ai.defaultModelId"
          layout="stacked"
          control={
            <SelectField
              label="Default model"
              options={modelOptions}
              value={selectedDefault}
              onChange={(defaultModelId) => update("ai", { defaultModelId })}
            />
          }
        />

        <SettingsRow
          title="Fallback model"
          description="Used automatically when the default model is unavailable."
          entryId="ai.fallbackModelId"
          layout="stacked"
          control={
            <SelectField
              label="Fallback model"
              placeholder="No fallback"
              options={modelOptions.filter((option) => option.value !== "")}
              value={ai.fallbackModelId ?? ""}
              onChange={(value) =>
                update("ai", { fallbackModelId: value === "" ? null : value })
              }
            />
          }
        />

        <div className={styles.catalogue}>
          <div className={styles.catalogueHead}>
            <span className={styles.catalogueTitle}>Available models</span>
            {catalog.loading ? (
              <StatusPill tone="muted">Loading…</StatusPill>
            ) : catalog.error ? (
              <StatusPill tone="muted">Unavailable</StatusPill>
            ) : catalog.catalog?.stale ? (
              <StatusPill tone="warning">Stale snapshot</StatusPill>
            ) : (
              <StatusPill tone="accent">
                {catalog.models.length} free {catalog.models.length === 1 ? "model" : "models"}
              </StatusPill>
            )}
          </div>

          {catalog.loading ? (
            <SkeletonText lines={4} />
          ) : catalog.error ? (
            <>
              <SettingsNote tone="warning" icon={<WarningIcon size={14} />}>
                Unable to load AI models. {catalog.error.message}
              </SettingsNote>
              <div className={styles.footerActions}>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={catalog.refetch}
                  disabled={catalog.refetching}
                >
                  {catalog.refetching ? "Retrying…" : "Retry"}
                </Button>
              </div>
            </>
          ) : catalog.models.length === 0 ? (
            <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
              No compatible free models are currently available.
            </SettingsNote>
          ) : (
            <>
              {catalog.models.map((model) => (
                <ModelPreferenceRow
                  key={model.id}
                  model={model}
                  selected={model.id === selectedDefault}
                  role={model.id === selectedDefault ? "Default" : undefined}
                  onSelect={() => update("ai", { defaultModelId: model.id })}
                />
              ))}
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                Catalog updated{" "}
                {catalog.catalog ? new Date(catalog.catalog.updatedAt).toLocaleString() : "recently"}
                {catalog.catalog?.stale
                  ? " — the provider could not be reached, so the previous snapshot is shown."
                  : "."}
              </SettingsNote>
            </>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Response behaviour">
        <SettingsRow
          title="Preferred response style"
          description="How much detail answers should carry by default."
          entryId="ai.responseStyle"
          layout="stacked"
          control={
            <SegmentedControl
              name="Preferred response style"
              size="sm"
              options={STYLE_OPTIONS}
              value={ai.responseStyle}
              onChange={(responseStyle) => update("ai", { responseStyle })}
            />
          }
        />

        <SettingsRow
          title="Creativity"
          description="Maps to provider temperature where the provider supports it."
          entryId="ai.creativity"
          layout="stacked"
          control={
            <>
              <Slider
                label="Creativity"
                min={0}
                max={100}
                step={5}
                value={ai.creativity}
                onChange={(creativity) => update("ai", { creativity })}
                formatValue={(value) =>
                  value <= 20
                    ? `${value} · focused`
                    : value >= 80
                      ? `${value} · exploratory`
                      : `${value} · balanced`
                }
                minLabel="Focused"
                maxLabel="Exploratory"
              />
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                Not every model accepts a temperature. Unsupported models will
                ignore this value.
              </SettingsNote>
            </>
          }
        />

        <SettingsRow
          title="Maximum response length"
          description="Caps output length. Provider default respects the model's own limit."
          entryId="ai.maxResponseLength"
          layout="stacked"
          control={
            <SelectField
              label="Maximum response length"
              options={LENGTH_OPTIONS}
              value={ai.maxResponseLength}
              onChange={(maxResponseLength) =>
                update("ai", { maxResponseLength })
              }
            />
          }
        />

        <SettingsRow
          title="Context behaviour"
          description="How earlier conversation content is carried into a new turn."
          entryId="ai.contextBehavior"
          layout="stacked"
          control={
            <SegmentedControl
              name="Context behaviour"
              size="sm"
              options={CONTEXT_OPTIONS}
              value={ai.contextBehavior}
              onChange={(contextBehavior) => update("ai", { contextBehavior })}
            />
          }
        />

        <SettingsRow
          title="Reasoning preference"
          description="Applies only to models that expose a reasoning control."
          entryId="ai.reasoningEffort"
          layout="stacked"
          control={
            <>
              <SelectField
                label="Reasoning preference"
                options={REASONING_OPTIONS}
                value={ai.reasoningEffort}
                onChange={(reasoningEffort) =>
                  update("ai", { reasoningEffort })
                }
              />
              <SettingsNote tone="warning" icon={<WarningIcon size={14} />}>
                Models without reasoning support ignore this setting; it is
                passed through only when the selected model accepts it.
              </SettingsNote>
            </>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Delivery and input">
        <SettingsSwitchRow
          title="Streaming"
          description="Deliver generation incrementally as it is produced."
          checked={ai.streaming}
          onChange={(streaming) => update("ai", { streaming })}
          htmlFor="ai-streaming"
          entryId="ai.streaming"
        />

        <SettingsSwitchRow
          title="Multimodal input"
          description="Allow images and documents as input where the model supports it."
          checked={ai.multimodalInput}
          onChange={(multimodalInput) => update("ai", { multimodalInput })}
          htmlFor="ai-multimodal"
          entryId="ai.multimodalInput"
        />
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Model preferences are validated against the live catalog when saved.
          Generation itself is wired into Chat in the next phase.
        </SettingsNote>
        <div className={styles.footerActions}>
          <ResetSettingsDialog target="ai" label="Reset AI" />
          <Button variant="subtle" size="sm" disabled>
            Manage models
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}