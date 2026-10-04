import type { SettingsSectionId } from "@/types";

/**
 * Indexed settings definitions.
 *
 * Every control in the Settings workspace registers here, which gives the
 * settings search real data to filter and keeps section metadata (title,
 * description, status) in one place instead of scattered across components.
 *
 * `path` is a dotted key into UserSettings, so a row can later be linked to
 * persistence without changing the registry shape.
 */
export type SettingsEntry = {
  id: string;
  section: SettingsSectionId;
  title: string;
  description: string;
  /**
   * Dotted key locating the setting. Profile entries are part of the user
   * record rather than the settings document, so the path is free-form.
   */
  path: string;
  keywords: string[];
};

export type SettingsSectionMeta = {
  id: SettingsSectionId;
  title: string;
  description: string;
  status?: string;
};

export const SETTINGS_SECTION_META: Record<SettingsSectionId, SettingsSectionMeta> = {
  profile: {
    id: "profile",
    title: "Profile",
    description:
      "Your identity inside the workspace, and the account details shown next to your name.",
  },
  appearance: {
    id: "appearance",
    title: "Appearance",
    description:
      "Customize how the application looks and behaves on this device.",
  },
  chat: {
    id: "chat",
    title: "Chat",
    description:
      "Defaults for the conversation surface: model, input behaviour and how messages are rendered.",
  },
  ai: {
    id: "ai",
    title: "AI & Models",
    description:
      "Default and fallback models, response behaviour and the capabilities enabled for generation.",
    status: "Not connected",
  },
  quiz: {
    id: "quiz",
    title: "Quiz defaults",
    description:
      "Values that prefill the Quiz builder. Each individual quiz can still be adjusted there.",
  },
  search: {
    id: "search",
    title: "Search",
    description:
      "How live web research should behave once a search provider is connected.",
    status: "Not connected",
  },
  files: {
    id: "files",
    title: "Files",
    description:
      "How uploaded material is handled. Type and size limits are also enforced by the server.",
  },
  notifications: {
    id: "notifications",
    title: "Notifications",
    description:
      "Which events should surface as notifications in the workspace.",
  },
  privacy: {
    id: "privacy",
    title: "Privacy",
    description:
      "Controls how your data is handled by this application. This is a preview of the policy.",
  },
  data: {
    id: "data",
    title: "Data management",
    description:
      "Export or remove stored content. Actions here are sensitive and require confirmation.",
    status: "Inactive phase",
  },
  api: {
    id: "api",
    title: "API providers",
    description:
      "Connection settings for model and search providers. Credentials will be stored server-side.",
    status: "Not configured",
  },
  advanced: {
    id: "advanced",
    title: "Advanced",
    description:
      "Deeper controls for behaviour, caching and experimental features. Enable with care.",
  },
};

export const SETTINGS_ENTRIES: SettingsEntry[] = [
  {
    id: "profile.displayName",
    section: "profile",
    title: "Display name",
    description: "The name shown in the sidebar and across the workspace.",
    path: "profile.displayName",
    keywords: ["name", "identity", "account"],
  },
  {
    id: "profile.username",
    section: "profile",
    title: "Username",
    description: "Optional handle that can be used to reference your account.",
    path: "profile.username",
    keywords: ["handle", "at", "tag"],
  },
  {
    id: "profile.email",
    section: "profile",
    title: "Email",
    description: "Contact address associated with the account.",
    path: "profile.email",
    keywords: ["mail", "contact", "account"],
  },
  {
    id: "profile.bio",
    section: "profile",
    title: "Bio",
    description: "Short description stored with your profile.",
    path: "profile.bio",
    keywords: ["about", "description"],
  },
  {
    id: "profile.avatar",
    section: "profile",
    title: "Profile photo",
    description: "Avatar preview, replacement and removal.",
    path: "profile.avatarId",
    keywords: ["avatar", "picture", "image", "photo"],
  },
  {
    id: "appearance.theme",
    section: "appearance",
    title: "Theme",
    description: "Dark, light or system appearance.",
    path: "appearance.theme",
    keywords: ["theme", "dark", "light", "system", "color scheme"],
  },
  {
    id: "appearance.density",
    section: "appearance",
    title: "Interface density",
    description: "Compact, comfortable or spacious spacing.",
    path: "appearance.density",
    keywords: ["density", "spacing", "compact", "spacious"],
  },
  {
    id: "appearance.motion",
    section: "appearance",
    title: "Animation",
    description: "Full, reduced or minimal motion.",
    path: "appearance.motion",
    keywords: ["animation", "motion", "transitions", "reduced"],
  },
  {
    id: "appearance.fontScale",
    section: "appearance",
    title: "Font size",
    description: "Scales the typography across the application.",
    path: "appearance.fontScale",
    keywords: ["font", "text size", "typography", "zoom"],
  },
  {
    id: "appearance.accent",
    section: "appearance",
    title: "Accent color",
    description: "Controls active navigation, primary buttons and focus.",
    path: "appearance.accent",
    keywords: ["accent", "color", "colour", "highlight", "brand"],
  },
  {
    id: "appearance.reduceTransparency",
    section: "appearance",
    title: "Reduce transparency",
    description: "Prefer solid surfaces over layered overlays.",
    path: "appearance.reduceTransparency",
    keywords: ["transparency", "blur", "accessibility"],
  },
  {
    id: "appearance.highContrast",
    section: "appearance",
    title: "High contrast",
    description: "Increase border and text separation where supported.",
    path: "appearance.highContrast",
    keywords: ["contrast", "accessibility", "visibility"],
  },
  {
    id: "chat.defaultModelId",
    section: "chat",
    title: "Default model",
    description: "Model the Chat workspace starts with.",
    path: "chat.defaultModelId",
    keywords: ["model", "assistant", "default"],
  },
  {
    id: "chat.enterKeyBehavior",
    section: "chat",
    title: "Enter key behaviour",
    description: "Whether Enter sends the message or inserts a new line.",
    path: "chat.enterKeyBehavior",
    keywords: ["enter", "keyboard", "send", "newline", "input"],
  },
  {
    id: "chat.streaming",
    section: "chat",
    title: "Streaming responses",
    description: "Render responses incrementally as they arrive.",
    path: "chat.streaming",
    keywords: ["stream", "streaming", "typing", "responses"],
  },
  {
    id: "chat.autoNameConversations",
    section: "chat",
    title: "Automatic conversation naming",
    description: "Suggest a title for new conversations.",
    path: "chat.autoNameConversations",
    keywords: ["title", "naming", "conversation", "history"],
  },
  {
    id: "chat.saveHistory",
    section: "chat",
    title: "Save conversation history",
    description: "Keep conversations available in the sidebar.",
    path: "chat.saveHistory",
    keywords: ["history", "save", "conversations"],
  },
  {
    id: "chat.messageDensity",
    section: "chat",
    title: "Message density",
    description: "Spacing between messages in a conversation.",
    path: "chat.messageDensity",
    keywords: ["density", "messages", "spacing"],
  },
  {
    id: "chat.codeRendering",
    section: "chat",
    title: "Code rendering",
    description: "Show code with rich formatting or as plain text.",
    path: "chat.codeRendering",
    keywords: ["code", "syntax", "format", "monospace"],
  },
  {
    id: "chat.showCitations",
    section: "chat",
    title: "Citation visibility",
    description: "Show sources attached to answers.",
    path: "chat.showCitations",
    keywords: ["citations", "sources", "references"],
  },
  {
    id: "chat.webResearch",
    section: "chat",
    title: "Web research",
    description: "Whether the assistant may consult the web.",
    path: "chat.webResearch",
    keywords: ["web", "research", "search", "internet"],
  },
  {
    id: "ai.defaultModelId",
    section: "ai",
    title: "Default model",
    description: "Primary model for AI generation.",
    path: "ai.defaultModelId",
    keywords: ["model", "default", "provider", "ai"],
  },
  {
    id: "ai.fallbackModelId",
    section: "ai",
    title: "Fallback model",
    description: "Used when the default model is unavailable.",
    path: "ai.fallbackModelId",
    keywords: ["fallback", "model", "backup"],
  },
  {
    id: "ai.responseStyle",
    section: "ai",
    title: "Preferred response style",
    description: "Concise, balanced or detailed answers.",
    path: "ai.responseStyle",
    keywords: ["style", "verbose", "concise", "detail"],
  },
  {
    id: "ai.creativity",
    section: "ai",
    title: "Creativity",
    description: "Maps to provider temperature where supported.",
    path: "ai.creativity",
    keywords: ["temperature", "creativity", "randomness"],
  },
  {
    id: "ai.maxResponseLength",
    section: "ai",
    title: "Maximum response length",
    description: "Cap on generated output length.",
    path: "ai.maxResponseLength",
    keywords: ["length", "tokens", "limit", "output"],
  },
  {
    id: "ai.contextBehavior",
    section: "ai",
    title: "Context behaviour",
    description: "How earlier conversation context is carried forward.",
    path: "ai.contextBehavior",
    keywords: ["context", "memory", "summarize"],
  },
  {
    id: "ai.reasoningEffort",
    section: "ai",
    title: "Reasoning preference",
    description: "Reasoning effort for models that support it.",
    path: "ai.reasoningEffort",
    keywords: ["reasoning", "thinking", "effort"],
  },
  {
    id: "ai.streaming",
    section: "ai",
    title: "Streaming",
    description: "Deliver generation incrementally.",
    path: "ai.streaming",
    keywords: ["streaming", "generation"],
  },
  {
    id: "ai.multimodalInput",
    section: "ai",
    title: "Multimodal input",
    description: "Allow images and documents as input.",
    path: "ai.multimodalInput",
    keywords: ["vision", "image", "multimodal", "input"],
  },
  {
    id: "quiz.subject",
    section: "quiz",
    title: "Default subject",
    description: "Subject selected when the builder opens.",
    path: "quiz.subject",
    keywords: ["subject", "quiz", "default"],
  },
  {
    id: "quiz.questionCount",
    section: "quiz",
    title: "Default number of questions",
    description: "Question count used for new quizzes.",
    path: "quiz.questionCount",
    keywords: ["questions", "count", "number"],
  },
  {
    id: "quiz.difficulty",
    section: "quiz",
    title: "Default difficulty",
    description: "Difficulty pre-filled in the builder.",
    path: "quiz.difficulty",
    keywords: ["difficulty", "easy", "hard"],
  },
  {
    id: "quiz.source",
    section: "quiz",
    title: "Default question source",
    description: "AI, database or mixed as the starting source.",
    path: "quiz.source",
    keywords: ["source", "database", "mixed", "ai"],
  },
  {
    id: "quiz.databaseShare",
    section: "quiz",
    title: "AI / database mixing",
    description: "Default balance for mixed-source quizzes.",
    path: "quiz.databaseShare",
    keywords: ["mix", "share", "balance", "database"],
  },
  {
    id: "quiz.explanations",
    section: "quiz",
    title: "Show explanations",
    description: "Include rationale after each answer by default.",
    path: "quiz.explanations",
    keywords: ["explanations", "answers", "rationale"],
  },
  {
    id: "quiz.timeLimitEnabled",
    section: "quiz",
    title: "Time limit",
    description: "Apply a time limit by default.",
    path: "quiz.timeLimitEnabled",
    keywords: ["time", "limit", "timer"],
  },
  {
    id: "search.provider",
    section: "search",
    title: "Search provider",
    description: "Source used for live web research.",
    path: "search.provider",
    keywords: ["provider", "search", "web"],
  },
  {
    id: "search.resultCount",
    section: "search",
    title: "Number of results",
    description: "How many results to surface per search.",
    path: "search.resultCount",
    keywords: ["results", "count", "search"],
  },
  {
    id: "search.safeSearch",
    section: "search",
    title: "Safe search",
    description: "Filtering level applied to results.",
    path: "search.safeSearch",
    keywords: ["safe", "filter", "content"],
  },
  {
    id: "search.researchDepth",
    section: "search",
    title: "Research depth",
    description: "How thoroughly a research task is followed.",
    path: "search.researchDepth",
    keywords: ["depth", "research", "thorough"],
  },
  {
    id: "search.citeSources",
    section: "search",
    title: "Cite sources",
    description: "Attach references to research answers.",
    path: "search.citeSources",
    keywords: ["citations", "sources", "references"],
  },
  {
    id: "files.maxFileSizeMb",
    section: "files",
    title: "Maximum file size",
    description: "Local guard before a file is accepted.",
    path: "files.maxFileSizeMb",
    keywords: ["size", "upload", "limit"],
  },
  {
    id: "files.autoAttach",
    section: "files",
    title: "Auto attach",
    description: "Attach selected material automatically.",
    path: "files.autoAttach",
    keywords: ["attach", "upload", "automatic"],
  },
  {
    id: "files.extractText",
    section: "files",
    title: "Extract text",
    description: "Prefer extracting text from documents.",
    path: "files.extractText",
    keywords: ["extract", "text", "documents"],
  },
  {
    id: "files.retention",
    section: "files",
    title: "File retention",
    description: "How long uploaded files are kept.",
    path: "files.retention",
    keywords: ["retention", "storage", "delete"],
  },
  {
    id: "notifications.quizCompleted",
    section: "notifications",
    title: "Quiz completion",
    description: "Notify when a quiz finishes.",
    path: "notifications.quizCompleted",
    keywords: ["notification", "quiz", "completion"],
  },
  {
    id: "notifications.generationCompleted",
    section: "notifications",
    title: "Generation completion",
    description: "Notify when generation finishes.",
    path: "notifications.generationCompleted",
    keywords: ["notification", "generation"],
  },
  {
    id: "notifications.errors",
    section: "notifications",
    title: "Errors",
    description: "Notify when something fails.",
    path: "notifications.errors",
    keywords: ["notification", "errors", "failures"],
  },
  {
    id: "notifications.accountUpdates",
    section: "notifications",
    title: "Account notifications",
    description: "Notify about account changes.",
    path: "notifications.accountUpdates",
    keywords: ["notification", "account"],
  },
  {
    id: "privacy.storeConversationHistory",
    section: "privacy",
    title: "Conversation history",
    description: "Keep conversations stored in the application.",
    path: "privacy.storeConversationHistory",
    keywords: ["privacy", "history", "conversations"],
  },
  {
    id: "privacy.storeQuizHistory",
    section: "privacy",
    title: "Quiz history",
    description: "Keep quiz results stored in the application.",
    path: "privacy.storeQuizHistory",
    keywords: ["privacy", "quiz", "history"],
  },
  {
    id: "privacy.allowPersonalization",
    section: "privacy",
    title: "Personalization",
    description: "Allow the workspace to adapt to your usage.",
    path: "privacy.allowPersonalization",
    keywords: ["privacy", "personalization", "adapt"],
  },
  {
    id: "privacy.allowAnalytics",
    section: "privacy",
    title: "Analytics",
    description: "Allow anonymous usage measurement.",
    path: "privacy.allowAnalytics",
    keywords: ["privacy", "analytics", "telemetry"],
  },
  {
    id: "privacy.allowModelImprovement",
    section: "privacy",
    title: "Model improvement",
    description: "Allow content to be used to improve models.",
    path: "privacy.allowModelImprovement",
    keywords: ["privacy", "training", "improvement"],
  },
  {
    id: "privacy.keepUploadedFiles",
    section: "privacy",
    title: "Saved files",
    description: "Keep uploaded files available after a session.",
    path: "privacy.keepUploadedFiles",
    keywords: ["privacy", "files", "storage"],
  },
  {
    id: "privacy.keepSearchHistory",
    section: "privacy",
    title: "Search history",
    description: "Keep a record of research queries.",
    path: "privacy.keepSearchHistory",
    keywords: ["privacy", "search", "history"],
  },
  {
    id: "privacy.incognitoMode",
    section: "privacy",
    title: "Incognito mode",
    description: "Avoid retaining session content by default.",
    path: "privacy.incognitoMode",
    keywords: ["privacy", "incognito", "private"],
  },
  {
    id: "api.openRouterKey",
    section: "api",
    title: "OpenRouter API key",
    description: "Credential used for model access.",
    path: "api.openRouterKeyConfigured",
    keywords: ["api", "key", "openrouter", "token", "credential"],
  },
  {
    id: "api.openRouterDefaultModelId",
    section: "api",
    title: "OpenRouter default model",
    description: "Model used when routing through OpenRouter.",
    path: "api.openRouterDefaultModelId",
    keywords: ["openrouter", "model", "default", "api"],
  },
  {
    id: "api.preferFreeModels",
    section: "api",
    title: "Prefer free models",
    description: "Bias routing toward free models.",
    path: "api.preferFreeModels",
    keywords: ["free", "models", "cost"],
  },
  {
    id: "api.requestTimeoutSeconds",
    section: "api",
    title: "Request timeout",
    description: "How long to wait before a request fails.",
    path: "api.requestTimeoutSeconds",
    keywords: ["timeout", "request", "network"],
  },
  {
    id: "advanced.developerMode",
    section: "advanced",
    title: "Developer mode",
    description: "Reveal additional diagnostics in the interface.",
    path: "advanced.developerMode",
    keywords: ["developer", "debug", "diagnostics"],
  },
  {
    id: "advanced.showDebugInfo",
    section: "advanced",
    title: "Debug information",
    description: "Show request IDs and timing details.",
    path: "advanced.showDebugInfo",
    keywords: ["debug", "info", "diagnostics"],
  },
  {
    id: "advanced.verboseErrors",
    section: "advanced",
    title: "Verbose errors",
    description: "Show technical detail in error messages.",
    path: "advanced.verboseErrors",
    keywords: ["errors", "verbose", "detail"],
  },
  {
    id: "advanced.experimentalQuizImport",
    section: "advanced",
    title: "Experimental quiz import",
    description: "Import quiz material from external formats.",
    path: "advanced.experimentalQuizImport",
    keywords: ["experimental", "quiz", "import"],
  },
  {
    id: "advanced.cacheBehavior",
    section: "advanced",
    title: "Cache behaviour",
    description: "How aggressively responses are cached.",
    path: "advanced.cacheBehavior",
    keywords: ["cache", "performance"],
  },
  {
    id: "advanced.performanceMode",
    section: "advanced",
    title: "Performance mode",
    description: "Balance quality against speed.",
    path: "advanced.performanceMode",
    keywords: ["performance", "speed", "quality"],
  },
];

/**
 * Free-text search over the registry. Matches title, description, keywords and
 * section, so "model" reaches AI → Default Model and "theme" reaches
 * Appearance → Theme. Scoring prefers title matches over body matches.
 */
export function searchSettings(query: string, limit = 8): SettingsEntry[] {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return [];

  const scored = SETTINGS_ENTRIES.map((entry) => {
    const title = entry.title.toLowerCase();
    const section = SETTINGS_SECTION_META[entry.section].title.toLowerCase();
    let score = 0;

    if (title === term) score += 100;
    if (title.startsWith(term)) score += 60;
    if (title.includes(term)) score += 40;
    if (section.startsWith(term)) score += 24;
    if (entry.keywords.some((keyword) => keyword.includes(term))) score += 20;
    if (entry.description.toLowerCase().includes(term)) score += 10;

    return { entry, score };
  }).filter((item) => item.score > 0);

  return scored
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((item) => item.entry);
}