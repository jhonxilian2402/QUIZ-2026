import type { Metadata } from "next";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import { isSettingsSection } from "@/components/settings/settingsPanels";
import type { SettingsSectionId } from "@/types";

type SettingsSectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams() {
  return (Object.keys(SETTINGS_SECTION_META) as SettingsSectionId[]).map(
    (section) => ({ section })
  );
}

export async function generateMetadata({
  params,
}: SettingsSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  if (!isSettingsSection(section)) return { title: "Settings" };
  return { title: `${SETTINGS_SECTION_META[section].title} · Settings` };
}

export default async function SettingsSectionPage({
  params,
}: SettingsSectionPageProps) {
  const { section } = await params;
  const resolved: SettingsSectionId = isSettingsSection(section)
    ? section
    : "profile";
  return <SettingsWorkspace section={resolved} />;
}