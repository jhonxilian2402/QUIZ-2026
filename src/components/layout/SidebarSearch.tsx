"use client";

import { useMemo, useState } from "react";
import { Input, Kbd } from "@/components/ui/Input";
import { SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import styles from "./SidebarSearch.module.css";

type SidebarSearchProps = {
  placeholder?: string;
  shortcut?: string;
};

/**
 * Chat search field. Frontend only — the query is held locally and no
 * filtering is performed until the conversation service is connected.
 *
 * Below the desktop breakpoint the labelled field collapses into a single
 * icon action so the rail stays usable instead of squeezing the input.
 */
export function SidebarSearch({
  placeholder = "Search chats",
  shortcut = "⌘ K",
}: SidebarSearchProps) {
  const [query, setQuery] = useState("");
  const trailing = useMemo(() => <Kbd>{shortcut}</Kbd>, [shortcut]);

  return (
    <>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search chats"
        leadingIcon={<SearchIcon size={14} />}
        trailing={trailing}
        autoComplete="off"
        fieldClassName={styles.root}
      />
      <button
        type="button"
        className={cn(styles.iconButton)}
        aria-label="Search chats"
      >
        <SearchIcon size={15} />
      </button>
    </>
  );
}