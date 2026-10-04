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
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { InfoIcon } from "@/components/ui/icons";
import { useModelCatalog } from "@/lib/api/useModelCatalog";
import { DENSITY_OPTIONS } from "@/lib/settingsDefaults";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./ChatSettings.module.css";

const ENTER_OPTIONS: QuizOption<"send" | "newline">[] = [
  { value: "send", label: "Enter sends", description: "Shift + Enter adds a line." },
  {
    value: "newline",
    label: "Enter adds a line",
    description: "Use the send button to submit.",
  },
];

const CODE_OPTIONS: QuizOption<"rich" | "plain">[] = [
  { value: "rich", label: "Rich" },
  { value: "plain", label: "Plain text" },
];

const RESEARCH_OPTIONS: QuizOption<"off" | "ask" | "always">[] = [
  { value: "off", label: "Off" },
  { value: "ask", label: "Ask first" },
  { value: "always", label: "Always" },
];

/**
 * Chat section. Sets the defaults the conversation surface reads on load. A
 * model chosen inside Chat is a temporary selection and never overwrites these
 * global preferences.
 */
export function ChatSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const chat = settings.chat;
  const dirty = dirtySections.includes("chat");
  const catalog = useModelCatalog({ freeOnly: true });

  const modelOptions: QuizOption<string>[] = [
    { value: "", label: "Automatic", description: "Resolved from the live catalog." },
    ...catalog.models.map((model) => ({
      value: model.id,
      label: model.name,
      description: `${model.provider} · ${model.available ? model.contextLabel : "Unavailable"}`,
    })),
  ];

  const selectedDefault =
    chat.defaultModelId === "assistant" ? "" : chat.defaultModelId;

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.chat}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup title="Model">
        <SettingsRow
          title="Default model"
          description="Model the Chat workspace starts with. You can still switch models per conversation."
          entryId="chat.defaultModelId"
          layout="stacked"
          control={
            <>
              <SelectField
                label="Default model"
                options={modelOptions}
                value={selectedDefault}
                onChange={(defaultModelId) => update("chat", { defaultModelId })}
              />
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                {catalog.loading
                  ? "Loading the live model catalog…"
                  : catalog.error
                    ? "The model catalog is unavailable right now. The saved preference is kept and validated again on the next save."
                    : "Options come from the live provider catalog and are verified when saved."}
              </SettingsNote>
            </>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Input">
        <SettingsRow
          title="Enter key behaviour"
          description="Decides what Enter does in the composer. Shift + Enter stays available for a new line either way."
          entryId="chat.enterKeyBehavior"
          layout="stacked"
          control={
            <SegmentedControl
              name="Enter key behaviour"
              size="sm"
              options={ENTER_OPTIONS}
              value={chat.enterKeyBehavior}
              onChange={(enterKeyBehavior) => update("chat", { enterKeyBehavior })}
            />
          }
        />

        <SettingsSwitchRow
          title="Spellcheck in composer"
          description="Underline spelling while you type."
          checked={chat.spellcheck}
          onChange={(spellcheck) => update("chat", { spellcheck })}
          htmlFor="chat-spellcheck"
          entryId="chat.spellcheck"
        />
      </SettingsGroup>

      <SettingsGroup title="Responses">
        <SettingsSwitchRow
          title="Streaming responses"
          description="Show the answer as it is produced instead of all at once."
          checked={chat.streaming}
          onChange={(streaming) => update("chat", { streaming })}
          htmlFor="chat-streaming"
          entryId="chat.streaming"
        />

        <SettingsRow
          title="Message density"
          description="Vertical spacing between messages in a conversation."
          entryId="chat.messageDensity"
          layout="stacked"
          control={
            <SegmentedControl
              name="Message density"
              size="sm"
              options={DENSITY_OPTIONS}
              value={chat.messageDensity}
              onChange={(messageDensity) => update("chat", { messageDensity })}
            />
          }
        />

        <SettingsRow
          title="Code rendering"
          description="How code blocks are presented in answers."
          entryId="chat.codeRendering"
          layout="stacked"
          control={
            <SegmentedControl
              name="Code rendering"
              size="sm"
              options={CODE_OPTIONS}
              value={chat.codeRendering}
              onChange={(codeRendering) => update("chat", { codeRendering })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Conversations">
        <SettingsSwitchRow
          title="Save conversation history"
          description="Keep conversations listed in the sidebar."
          checked={chat.saveHistory}
          onChange={(saveHistory) => update("chat", { saveHistory })}
          htmlFor="chat-save-history"
          entryId="chat.saveHistory"
        />

        <SettingsSwitchRow
          title="Automatic conversation naming"
          description="Suggest a short title for each new conversation."
          checked={chat.autoNameConversations}
          onChange={(autoNameConversations) =>
            update("chat", { autoNameConversations })
          }
          htmlFor="chat-auto-name"
          entryId="chat.autoNameConversations"
        />
      </SettingsGroup>

      <SettingsGroup title="Research and sources">
        <SettingsSwitchRow
          title="Citation visibility"
          description="Show the sources behind an answer when they exist."
          checked={chat.showCitations}
          onChange={(showCitations) => update("chat", { showCitations })}
          htmlFor="chat-citations"
          entryId="chat.showCitations"
        />

        <SettingsRow
          title="Web research"
          description="Whether answers may consult web sources. Requires a connected search provider."
          entryId="chat.webResearch"
          layout="stacked"
          control={
            <>
              <SegmentedControl
                name="Web research"
                size="sm"
                options={RESEARCH_OPTIONS}
                value={chat.webResearch}
                onChange={(webResearch) => update("chat", { webResearch })}
              />
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                No search provider is connected. This preference is stored for
                the moment one is.
              </SettingsNote>
            </>
          }
        />
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          These are global defaults. Changing the model inside a conversation
          does not modify them.
        </SettingsNote>
        <ResetSettingsDialog target="chat" label="Reset Chat" />
      </div>
    </SettingsSection>
  );
}