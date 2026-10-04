import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import styles from "./SettingsSection.module.css";

type SettingsSectionProps = {
  id?: string;
  title: string;
  description: string;
  status?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Section frame. Establishes hierarchy with a restrained title block — never a
 * hero — plus an optional honest status pill and a section-level action.
 */
export function SettingsSection({
  id,
  title,
  description,
  status,
  action,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn(styles.section, className)}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.headerAside}>
          {status ? <StatusPill tone="muted">{status}</StatusPill> : null}
          {action}
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

type SettingsGroupProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Logical grouping inside a section. A group carries its own card, but rows
 * inside it are separated by hairlines rather than individual borders, which
 * keeps the page calm.
 */
export function SettingsGroup({
  title,
  description,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <div className={cn(styles.group, className)}>
      {title ? (
        <div className={styles.groupHead}>
          <h2 className={styles.groupTitle}>{title}</h2>
          {description ? (
            <p className={styles.groupDescription}>{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className={styles.groupBody}>{children}</div>
    </div>
  );
}

type SettingsRowProps = {
  title: string;
  description?: string;
  /** The control rendered on the right of the row. */
  control: ReactNode;
  /** Layout hint: inline control, stacked control, or full-width panel. */
  layout?: "inline" | "stacked";
  /** For stacked rows, whether the control spans the row or sits at its own width. */
  controlWidth?: "full" | "auto";
  disabled?: boolean;
  /** Registry id, used to highlight a row reached from settings search. */
  entryId?: string;
  className?: string;
};

/**
 * Standard settings row: title and description on the left, control on the
 * right. Complex settings use `layout="stacked"` instead of forcing a control
 * into the narrow column; `controlWidth="auto"` keeps compact controls such as
 * a stepper from stretching across the row.
 */
export function SettingsRow({
  title,
  description,
  control,
  layout = "inline",
  controlWidth = "full",
  disabled = false,
  entryId,
  className,
}: SettingsRowProps) {
  return (
    <div
      id={entryId}
      className={cn(
        styles.row,
        layout === "stacked" && styles.rowStacked,
        disabled && styles.rowDisabled,
        className
      )}
      data-setting={entryId}
    >
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {description ? (
          <span className={styles.rowDescription}>{description}</span>
        ) : null}
      </div>
      <div
        className={cn(
          styles.rowControl,
          layout === "stacked" && controlWidth === "auto" && styles.controlAuto
        )}
      >
        {control}
      </div>
    </div>
  );
}

export function SettingsNote({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "accent";
  icon?: ReactNode;
}) {
  return (
    <p className={cn(styles.note, styles[`note_${tone}`])}>
      {icon ? <span className={styles.noteIcon}>{icon}</span> : null}
      <span>{children}</span>
    </p>
  );
}

type SettingsSwitchRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  htmlFor: string;
  entryId?: string;
  disabled?: boolean;
  /** Marks the row as an experimental opt-in. */
  experimental?: boolean;
};

/**
 * Settings row whose control is a switch. The switch stays a real checkbox with
 * an accessible label, so keyboard and screen-reader behaviour is unchanged.
 */
export function SettingsSwitchRow({
  title,
  description,
  checked,
  onChange,
  htmlFor,
  entryId,
  disabled = false,
  experimental = false,
}: SettingsSwitchRowProps) {
  return (
    <SettingsRow
      title={experimental ? `${title} · Experimental` : title}
      description={description}
      entryId={entryId}
      disabled={disabled}
      layout="inline"
      control={
        <Switch
          id={htmlFor}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={title}
        />
      }
    />
  );
}