"use client";

import { useMemo, useState } from "react";
import { QUIZ_SUBJECTS } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import { CheckMark } from "@/components/ui/CheckMark";
import { Input } from "@/components/ui/Input";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import styles from "./SubjectSelector.module.css";

type SubjectSelectorProps = {
  value: string;
  onChange: (subject: string) => void;
};

/**
 * Searchable subject picker. The predefined list and the custom entry write to
 * the same value, so a future database-backed catalogue can replace the list
 * without changing the contract.
 */
export function SubjectSelector({ value, onChange }: SubjectSelectorProps) {
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return QUIZ_SUBJECTS;
    return QUIZ_SUBJECTS.filter((subject) =>
      subject.toLowerCase().includes(term)
    );
  }, [query]);

  const exactMatch = QUIZ_SUBJECTS.some(
    (subject) => subject.toLowerCase() === query.trim().toLowerCase()
  );

  const commitCustom = () => {
    const next = customDraft.trim();
    if (!next) return;
    onChange(next);
    setCustomDraft("");
    setCustomOpen(false);
    setQuery("");
  };

  return (
    <div className={styles.root}>
      <div className={styles.searchRow}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subjects"
          aria-label="Search subjects"
          leadingIcon={<SearchIcon size={15} />}
          fieldClassName={styles.search}
        />
        <button
          type="button"
          className={styles.customToggle}
          onClick={() => setCustomOpen((open) => !open)}
        >
          <PlusIcon size={14} />
          Custom subject
        </button>
      </div>

      {customOpen ? (
        <div className={styles.customRow}>
          <Input
            value={customDraft}
            onChange={(event) => setCustomDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitCustom();
              }
            }}
            placeholder="Type a subject name"
            aria-label="Custom subject"
            autoFocus
            fieldClassName={styles.search}
          />
          <button
            type="button"
            className={styles.customAdd}
            onClick={commitCustom}
            disabled={customDraft.trim().length === 0}
          >
            Add
          </button>
        </div>
      ) : null}

      <div className={styles.grid} role="listbox" aria-label="Subjects">
        {filtered.map((subject) => {
          const selected = subject === value;
          return (
            <button
              key={subject}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(styles.option, selected && styles.optionActive)}
              onClick={() => onChange(subject)}
            >
              <span className={styles.optionLabel}>{subject}</span>
              {selected ? (
                <CheckMark className={styles.check} size={14} />
              ) : null}
            </button>
          );
        })}

        {value && !QUIZ_SUBJECTS.includes(value) ? (
          <button
            type="button"
            role="option"
            aria-selected
            className={cn(styles.option, styles.optionActive)}
            onClick={() => onChange(value)}
          >
            <span className={styles.optionLabel}>{value}</span>
            <CheckMark className={styles.check} size={14} />
          </button>
        ) : null}

        {filtered.length === 0 && !exactMatch && query.trim().length > 0 ? (
          <button
            type="button"
            className={cn(styles.option, styles.optionCustom)}
            onClick={() => {
              onChange(query.trim());
              setQuery("");
            }}
          >
            <span className={styles.optionLabel}>
              Use &ldquo;{query.trim()}&rdquo;
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}