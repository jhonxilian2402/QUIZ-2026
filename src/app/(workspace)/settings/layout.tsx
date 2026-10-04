import type { Metadata } from "next";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings route group. SettingsProvider is mounted app-wide in the workspace
 * layout; this layout only adds the subordinate settings navigation.
 */
export default function SettingsLayoutRoute({
  children,
}: {
  children: ReactNode;
}) {
  return <SettingsLayout>{children}</SettingsLayout>;
}