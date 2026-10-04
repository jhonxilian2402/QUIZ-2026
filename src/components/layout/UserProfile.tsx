"use client";

import { ChevronDownIcon } from "@/components/ui/icons";
import {
  Dropdown,
  DropdownDivider,
  DropdownGroupLabel,
  DropdownItem,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionProvider";
import { authService } from "@/lib/api/services";
import { useToast } from "@/components/ui/Toast";
import styles from "./UserProfile.module.css";

type UserProfileProps = {
  /** Overrides the session for tests/stories; defaults to the live session. */
  name?: string;
  plan?: string;
  initials?: string;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/**
 * Account block in the sidebar footer.
 *
 * Reads the signed-in user from the session, so the displayed identity is the
 * real account rather than placeholder text. Signing out revokes the session
 * server-side and returns the shell to the sign-in screen.
 */
export function UserProfile({ name, plan, initials }: UserProfileProps) {
  const { user, refresh } = useSession();
  const { notify } = useToast();

  const displayName = name ?? user?.displayName ?? "Not signed in";
  const displayPlan = plan ?? (user ? `@${user.username ?? user.email.split("@")[0]}` : "Guest");
  const displayInitials = initials ?? initialsFrom(displayName);

  const signOut = async () => {
    try {
      await authService.logout();
      notify({ tone: "info", title: "Signed out" });
    } finally {
      refresh();
    }
  };

  return (
    <Dropdown
      align="start"
      className={styles.root}
      trigger={({ open }) => (
        <button
          type="button"
          className={cn(styles.trigger, open && styles.open)}
          aria-label="Account menu"
        >
          <span className={styles.avatar} aria-hidden>
            {displayInitials}
          </span>
          <span className={styles.meta}>
            <span className={styles.name}>{displayName}</span>
            <span className={styles.plan}>{displayPlan}</span>
          </span>
          <span className={styles.chevron}>
            <ChevronDownIcon size={15} />
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <DropdownGroupLabel>Account</DropdownGroupLabel>
          <DropdownItem
            onSelect={() => {
              close();
              window.location.assign("/settings/profile");
            }}
          >
            Profile
          </DropdownItem>
          <DropdownItem
            onSelect={() => {
              close();
              window.location.assign("/settings");
            }}
          >
            Preferences
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem
            onSelect={() => {
              close();
              void signOut();
            }}
          >
            Sign out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}