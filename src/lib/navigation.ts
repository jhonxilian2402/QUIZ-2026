import { HomeIcon, QuizIcon, SettingsIcon } from "@/components/ui/icons";
import type { NavItem } from "@/types";

/**
 * Primary navigation. Order and labels mirror the reference sidebar.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", href: "/", icon: HomeIcon },
  { id: "quiz", label: "Quiz", href: "/quiz", icon: QuizIcon },
  { id: "settings", label: "Settings", href: "/settings", icon: SettingsIcon },
];