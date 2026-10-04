"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Highlights the settings row targeted by the `focus` query parameter, which is
 * how Settings search links a result to its control. The row carries a
 * `data-setting` id; the highlight fades on its own.
 */
export function useSettingsFocus() {
  const params = useSearchParams();
  const focus = params.get("focus");

  useEffect(() => {
    if (!focus) return;
    const node = document.querySelector<HTMLElement>(
      `[data-setting="${CSS.escape(focus)}"]`
    );
    if (!node) return;

    node.dataset.highlight = "true";
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => {
      delete node.dataset.highlight;
    }, 1400);
    return () => clearTimeout(timer);
  }, [focus]);
}