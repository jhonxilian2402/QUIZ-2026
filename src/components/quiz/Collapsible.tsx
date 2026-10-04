"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";
import styles from "./Collapsible.module.css";

type CollapsibleProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
};

/**
 * Lightweight disclosure used to keep the advanced block short. The header is
 * a real button so keyboard users can fold sections without a mouse.
 */
export function Collapsible({
  title,
  description,
  defaultOpen = false,
  trailing,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={cn(styles.root, open && styles.open)}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.text}>
            <span className={styles.title}>{title}</span>
            {description ? (
              <span className={styles.description}>{description}</span>
            ) : null}
          </span>
          <span className={cn(styles.chevron, open && styles.chevronOpen)}>
            <ChevronDownIcon size={15} />
          </span>
        </button>
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      {open ? (
        <div id={id} className={styles.body}>
          {children}
        </div>
      ) : null}
    </div>
  );
}