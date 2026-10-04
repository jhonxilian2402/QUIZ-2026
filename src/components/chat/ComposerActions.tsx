"use client";

import { COMPOSER_ACTIONS } from "@/lib/composerActions";
import { Tooltip } from "@/components/ui/Tooltip";
import { MicIcon, WaveformIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";
import type { ComposerAction, ComposerActionId } from "@/types";
import styles from "./ComposerActions.module.css";

type ComposerActionsProps = {
  actions?: ComposerAction[];
  disabled?: boolean;
  onAction?: (id: ComposerActionId) => void;
  onVoice?: () => void;
  onAudio?: () => void;
  voiceActive?: boolean;
  audioActive?: boolean;
};

/**
 * Composer control row: quick actions on the left, voice/audio on the right.
 * All handlers are optional so the row can render fully inert.
 */
export function ComposerActions({
  actions = COMPOSER_ACTIONS,
  disabled = false,
  onAction,
  onVoice,
  onAudio,
  voiceActive = false,
  audioActive = false,
}: ComposerActionsProps) {
  return (
    <>
      <div className={styles.actionsGroup}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => onAction?.(action.id)}
              aria-label={action.label}
              className={cn(
                styles.action,
                action.id === "attach" && styles.iconOnly
              )}
            >
              <span className={styles.actionIcon}>
                <Icon size={action.id === "attach" ? 15 : 14} />
              </span>
              {action.id !== "attach" ? (
                <span className={styles.label}>{action.label}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={styles.utilitiesGroup}>
        <Tooltip label="Voice input">
          <IconButton
            label="Voice input"
            size="sm"
            disabled={disabled}
            active={voiceActive}
            onClick={onVoice}
          >
            <MicIcon size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Audio mode">
          <IconButton
            label="Audio mode"
            size="sm"
            disabled={disabled}
            active={audioActive}
            onClick={onAudio}
          >
            <WaveformIcon size={16} />
          </IconButton>
        </Tooltip>
      </div>
    </>
  );
}