import { ImagePlusIcon, GlobeIcon, PaperclipIcon } from "@/components/ui/icons";
import type { ComposerAction } from "@/types";

/**
 * Composer quick actions. Rendering only — behaviour is wired in a later phase.
 */
export const COMPOSER_ACTIONS: ComposerAction[] = [
  { id: "attach", label: "Attachment", icon: PaperclipIcon },
  { id: "image", label: "Create an image", icon: ImagePlusIcon },
  { id: "search", label: "Search the web", icon: GlobeIcon },
];