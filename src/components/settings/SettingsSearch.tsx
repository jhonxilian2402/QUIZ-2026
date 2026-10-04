"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchSettings } from "@/lib/settingsRegistry";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import { cn } from "@/lib/utils";
import { SearchIcon } from "@/components/ui/icons";
import styles from "./SettingsSearch.module.css";

/**
 * Settings search. Results come from the indexed settings registry, so adding
 * a setting automatically makes it searchable. Selecting a result navigates to
 * the owning section and highlights the matched row.
 */
export function SettingsSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchSettings(query), [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const goTo = (entryId: string, sectionId: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/settings/${sectionId}?focus=${encodeURIComponent(entryId)}`);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={cn(styles.field, open && styles.fieldOpen)}>
        <span className={styles.icon}>
          <SearchIcon size={14} />
        </span>
        <input
          className={styles.input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[activeIndex]) {
              const entry = results[activeIndex];
              goTo(entry.id, entry.section);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search settings"
          aria-label="Search settings"
          aria-expanded={open && query.trim().length > 0}
          role="combobox"
          aria-controls="settings-search-results"
          autoComplete="off"
        />
      </div>

      {open && query.trim().length > 0 ? (
        <div
          id="settings-search-results"
          className={styles.results}
          role="listbox"
          aria-label="Settings results"
        >
          {results.length === 0 ? (
            <p className={styles.empty}>No settings match that term.</p>
          ) : (
            results.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  styles.result,
                  index === activeIndex && styles.resultActive
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => goTo(entry.id, entry.section)}
              >
                <span className={styles.resultText}>
                  <span className={styles.resultTitle}>{entry.title}</span>
                  <span className={styles.resultDescription}>
                    {entry.description}
                  </span>
                </span>
                <span className={styles.resultSection}>
                  {SETTINGS_SECTION_META[entry.section].title}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}