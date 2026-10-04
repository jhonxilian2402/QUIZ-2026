"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import styles from "./Textarea.module.css";

export type ComposerSurfaceHandle = {
  focus: () => void;
  blur: () => void;
};

type ComposerSurfaceProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxRows?: number;
  expandable?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  ariaLabel?: string;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  textareaClassName?: string;
  footerClassName?: string;
  spellCheck?: boolean;
  aboveBody?: ReactNode;
};

const LINE_HEIGHT = 22;
const MIN_ROWS = 1;

export const ComposerSurface = forwardRef<
  ComposerSurfaceHandle,
  ComposerSurfaceProps
>(function ComposerSurface(
  {
    value,
    onValueChange,
    placeholder,
    disabled = false,
    maxRows = 9,
    expandable = true,
    onKeyDown,
    ariaLabel,
    footer,
    className,
    bodyClassName,
    textareaClassName,
    footerClassName,
    spellCheck = false,
    aboveBody,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node || !expandable) return;
    const maxHeight = maxRows * LINE_HEIGHT;
    node.style.height = "auto";
    if (node.scrollHeight > maxHeight) {
      node.style.height = `${maxHeight}px`;
      node.style.overflowY = "auto";
      return;
    }
    node.style.height = `${Math.max(node.scrollHeight, MIN_ROWS * LINE_HEIGHT)}px`;
    node.style.overflowY = "hidden";
  }, [expandable, maxRows, value]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
    }),
    []
  );

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const node = event.target;
    onValueChange(node.value);

    if (!expandable) return;
    const maxHeight = maxRows * LINE_HEIGHT;
    if (node.scrollHeight > maxHeight) {
      node.style.height = `${maxHeight}px`;
      node.style.overflowY = "auto";
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.max(
      Math.min(node.scrollHeight, maxHeight),
      MIN_ROWS * LINE_HEIGHT
    )}px`;
    node.style.overflowY = "hidden";
  };

  return (
    <div
      className={cn(
        styles.shell,
        focused && styles.focused,
        disabled && styles.disabled,
        className
      )}
      onClick={() => textareaRef.current?.focus()}
    >
      {aboveBody ? aboveBody : null}
      <div className={cn(styles.body, bodyClassName)}>
        <textarea
          ref={textareaRef}
          className={cn(styles.textarea, textareaClassName)}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          rows={MIN_ROWS}
          spellCheck={spellCheck}
        />
      </div>
      {footer ? (
        <div className={cn(styles.footer, footerClassName)}>{footer}</div>
      ) : null}
    </div>
  );
});