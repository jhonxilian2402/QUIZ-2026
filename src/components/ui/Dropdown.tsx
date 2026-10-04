"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CheckMark } from "./CheckMark";
import styles from "./Dropdown.module.css";

type DropdownProps = {
  trigger: (state: { open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  menuClassName?: string;
};

const EDGE_GAP = 8;

/**
 * Anchored menu with viewport awareness and keyboard support.
 *
 * The menu flips above the trigger and shifts horizontally when it would
 * otherwise overflow the viewport, so it is never clipped off-screen. Arrow
 * keys move focus between items; Escape closes and restores focus to the
 * trigger.
 */
export function Dropdown({
  trigger,
  children,
  align = "start",
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{
    shift: number;
    flip: boolean;
  }>({ shift: 0, flip: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.querySelector("button")?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Measure after paint and correct for viewport collisions, then move focus
  // into the menu so keyboard users can navigate it immediately.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;

    const menuRect = menu.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    let shift = 0;
    if (menuRect.right > viewportWidth - EDGE_GAP) {
      shift = viewportWidth - EDGE_GAP - menuRect.right;
    }
    if (menuRect.left + shift < EDGE_GAP) {
      shift += EDGE_GAP - (menuRect.left + shift);
    }

    // Flip above only when there is clearly more room there.
    const spaceBelow = viewportHeight - rootRect.bottom;
    const flip = spaceBelow < menuRect.height + EDGE_GAP && rootRect.top > menuRect.height;

    setPlacement({ shift: Math.round(shift), flip });

    const items = menu.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]:not([disabled])'
    );
    const selected = menu.querySelector<HTMLElement>(
      '[role="menuitemradio"][aria-checked="true"]:not([disabled])'
    );
    (selected ?? items[0])?.focus();
  }, [open]);

  const focusItem = (direction: 1 | -1) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]:not([disabled])'
      ) ?? []
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      current === -1
        ? direction === 1
          ? 0
          : items.length - 1
        : (current + direction + items.length) % items.length;
    items[next].focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitemradio"]:not([disabled])'
        ) ?? []
      );
      const target = event.key === "Home" ? items[0] : items[items.length - 1];
      target?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <div
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger({ open })}
      </div>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            styles.menu,
            align === "end" && styles.alignEnd,
            placement.flip && styles.flip,
            menuClassName
          )}
          style={{ transform: `translateX(${placement.shift}px)` }}
          onKeyDown={onMenuKeyDown}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownGroupLabel({ children }: { children: ReactNode }) {
  return <div className={styles.groupLabel}>{children}</div>;
}

export function DropdownDivider() {
  return <div className={styles.divider} role="separator" />;
}

type DropdownItemProps = {
  children: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export function DropdownItem({
  children,
  meta,
  selected = false,
  disabled = false,
  onSelect,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      disabled={disabled}
      className={cn(styles.item, selected && styles.itemSelected)}
      onClick={onSelect}
    >
      <span>
        {children}
        {meta ? <span className={styles.itemMeta}>{meta}</span> : null}
      </span>
      {selected ? <CheckMark className={styles.check} /> : null}
    </button>
  );
}

export function DropdownEmpty({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}