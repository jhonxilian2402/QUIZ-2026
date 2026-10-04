import { redirect } from "next/navigation";

/**
 * Settings has no index panel of its own; the first section is the entry point.
 */
export default function SettingsIndexPage() {
  redirect("/settings/profile");
}