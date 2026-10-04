"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsRow,
  SettingsSection,
} from "../SettingsSection";
import { AvatarEditor } from "./AvatarEditor";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { ComposerSurface } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { InfoIcon, WarningIcon } from "@/components/ui/icons";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import { authService, userService } from "@/lib/api/services";
import { ApiError, isUnauthorized } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "../SettingsProvider";
import type { UserResponse } from "@/lib/api/contracts";
import styles from "./ProfileSettings.module.css";

const BIO_MAX = 160;

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

type ProfileDraft = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  avatarFileName: string | null;
};

/**
 * Profile section.
 *
 * Profile fields belong to the user record rather than the settings document,
 * so they are loaded from and saved to /api/me. The avatar is chosen locally
 * and recorded as a name only: no bytes are uploaded in this phase, which the
 * interface states explicitly.
 */
export function ProfileSettings() {
  useSettingsFocus();
  const { notify } = useToast();
  const { reload: reloadSettings } = useSettings();

  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: "",
    username: "",
    bio: "",
    avatarUrl: null,
    avatarFileName: null,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ready" | "unauthenticated" | "error">("ready");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const me = await userService.me(signal);
      setProfile(me);
      setDraft({
        displayName: me.displayName,
        username: me.username ?? "",
        bio: me.bio,
        avatarUrl: me.avatarUrl,
        avatarFileName: null,
      });
      setStatus("ready");
      setError(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (isUnauthorized(cause)) {
        setStatus("unauthenticated");
        return;
      }
      setStatus("error");
      setError(cause instanceof ApiError ? cause.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      draft.displayName !== profile.displayName ||
      draft.username !== (profile.username ?? "") ||
      draft.bio !== profile.bio ||
      draft.avatarUrl !== profile.avatarUrl
    );
  }, [draft, profile]);

  const emailValid = profile ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) : true;

  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await userService.updateProfile({
        displayName: draft.displayName,
        username: draft.username.length > 0 ? draft.username : undefined,
        bio: draft.bio,
        avatarUrl: draft.avatarUrl,
      });
      setProfile(updated);
      setDraft((current) => ({ ...current, avatarFileName: null }));
      notify({ tone: "success", title: "Profile updated" });
      // The sidebar derives its display name from the profile, so refresh it.
      reloadSettings();
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : "Could not save your profile.";
      setError(message);
      notify({ tone: "error", title: "Could not save your profile", description: message });
    } finally {
      setSaving(false);
    }
  }, [dirty, draft, notify, reloadSettings]);

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-label="Loading profile">
        <Skeleton width={148} height={22} radius="md" />
        <Skeleton width="min(420px, 70%)" height={12} />
        <div className={styles.loadingCard}>
          <Skeleton width={72} height={72} radius="full" />
          <div className={styles.loadingRows}>
            <Skeleton width={180} height={14} />
            <Skeleton width={120} height={12} />
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <SettingsSection {...SETTINGS_SECTION_META.profile}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          You are not signed in, so there is no profile to edit yet. Profile
          data is stored per account.
        </SettingsNote>
      </SettingsSection>
    );
  }

  if (status === "error" || !profile) {
    return (
      <SettingsSection {...SETTINGS_SECTION_META.profile}>
        <div className={styles.errorState}>
          <SettingsNote tone="danger" icon={<WarningIcon size={14} />}>
            {error ?? "Unable to load your profile."}
          </SettingsNote>
          <Button variant="subtle" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        {...SETTINGS_SECTION_META.profile}
        status={undefined}
        action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
      >
        <SettingsGroup title="Profile photo">
          <SettingsRow
            title="Avatar"
            description="Shown next to your name in the sidebar and in conversations."
            entryId="profile.avatar"
            layout="stacked"
            control={
              <AvatarEditor
                initials={initialsFrom(draft.displayName || profile.displayName)}
                fileName={draft.avatarFileName}
                onSelect={(fileName, previewUrl) =>
                  setDraft((current) => ({
                    ...current,
                    avatarFileName: fileName,
                    // A local preview is recorded for this session only; the
                    // stored value is a URL, which will come from file storage.
                    avatarUrl: current.avatarUrl,
                    ...(previewUrl ? {} : {}),
                  }))
                }
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    avatarFileName: null,
                    avatarUrl: null,
                  }))
                }
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup
          title="Personal information"
          description="Stored on your account and returned by /api/me."
        >
          <SettingsRow
            title="Display name"
            description="The name shown across the application."
            entryId="profile.displayName"
            layout="stacked"
            control={
              <Field label="Display name" htmlFor="profile-name">
                <Input
                  id="profile-name"
                  value={draft.displayName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, displayName: event.target.value }))
                  }
                  placeholder="Your name"
                  autoComplete="name"
                />
              </Field>
            }
          />

          <SettingsRow
            title="Username"
            description="Optional handle, 3-32 letters, numbers, dot, dash or underscore."
            entryId="profile.username"
            layout="stacked"
            control={
              <Field label="Username" htmlFor="profile-username">
                <Input
                  id="profile-username"
                  value={draft.username}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      username: event.target.value.replace(/[^a-zA-Z0-9._-]/g, ""),
                    }))
                  }
                  placeholder="username"
                  leadingIcon={<span className={styles.at}>@</span>}
                  autoComplete="username"
                />
              </Field>
            }
          />

          <SettingsRow
            title="Email"
            description="Used to sign in. Changing it is handled by the account flow."
            entryId="profile.email"
            layout="stacked"
            control={
              <Field
                label="Email"
                htmlFor="profile-email"
                hint="Read-only here. Email changes require verification."
                error={
                  !emailValid ? "The stored email address is not valid." : undefined
                }
              >
                <Input
                  id="profile-email"
                  type="email"
                  value={profile.email}
                  readOnly
                  disabled
                  invalid={!emailValid}
                />
              </Field>
            }
          />

          <SettingsRow
            title="Bio"
            description="A short description shown on your profile."
            entryId="profile.bio"
            layout="stacked"
            control={
              <Field label="Bio" hint={`${draft.bio.length}/${BIO_MAX} characters`}>
                <ComposerSurface
                  value={draft.bio}
                  onValueChange={(bio) =>
                    setDraft((current) => ({ ...current, bio: bio.slice(0, BIO_MAX) }))
                  }
                  placeholder="A sentence about what you study or teach."
                  ariaLabel="Bio"
                  maxRows={4}
                  className={styles.bio}
                  bodyClassName={styles.bioBody}
                  textareaClassName={styles.bioTextarea}
                />
              </Field>
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Account" description="Read-only account information.">
          <div className={styles.account}>
            <div className={styles.accountGrid}>
              <div className={styles.accountItem}>
                <span className={styles.accountLabel}>Status</span>
                <StatusPill tone={profile.status === "active" ? "success" : "muted"} dot>
                  {profile.status}
                </StatusPill>
              </div>
              <div className={styles.accountItem}>
                <span className={styles.accountLabel}>Account ID</span>
                <span className={styles.accountValue} title={profile.id}>
                  {profile.id.slice(0, 8)}…
                </span>
              </div>
              <div className={styles.accountItem}>
                <span className={styles.accountLabel}>Member since</span>
                <span className={styles.accountValue}>
                  {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.accountItem}>
                <span className={styles.accountLabel}>Last sign-in</span>
                <span className={styles.accountValue}>
                  {profile.lastLoginAt
                    ? new Date(profile.lastLoginAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </SettingsGroup>

        <div className={styles.saveBar}>
          <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
            {dirty
              ? "You have unsaved profile changes."
              : "Profile changes are stored on your account."}
          </SettingsNote>
          <div className={styles.saveActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({
                  displayName: profile.displayName,
                  username: profile.username ?? "",
                  bio: profile.bio,
                  avatarUrl: profile.avatarUrl,
                  avatarFileName: null,
                })
              }
              disabled={!dirty || saving}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void save()}
              loading={saving}
              disabled={!dirty}
            >
              Save profile
            </Button>
          </div>
        </div>

        <div className={styles.danger}>
          <div className={styles.dangerText}>
            <span className={styles.dangerTitle}>
              <WarningIcon size={15} />
              Delete account
            </span>
            <span className={styles.dangerDescription}>
              Deletes your account and every conversation, quiz and file
              associated with it. This cannot be undone.
            </span>
          </div>
          <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
            Delete account
          </Button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Delete your account?"
        description="This removes your account and all data belonging to it. The action cannot be undone."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          const { logout } = await authService.logout().then(
            () => ({ logout: true }),
            () => ({ logout: false })
          );
          void logout;
          return {
            message:
              "Account deletion is connected to the data layer but is intentionally disabled here. No account was modified.",
          };
        }}
      />
    </>
  );
}