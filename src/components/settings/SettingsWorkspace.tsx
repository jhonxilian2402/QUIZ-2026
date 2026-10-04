"use client";

import { SETTINGS_PANELS } from "./settingsPanels";
import type { SettingsSectionId } from "@/types";

/**
 * Renders the panel for the active settings section. Section identity comes
 * from the route, so refresh and browser navigation land on the same panel.
 */
export function SettingsWorkspace({ section }: { section: SettingsSectionId }) {
  const Panel = SETTINGS_PANELS[section];
  return <Panel />;
}