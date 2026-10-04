/**
 * Small shared constants that are not user-facing copy.
 */
export const INVALID = {
  /** Loose shape check for an OpenRouter-style key. Never used for auth. */
  API_KEY_SHAPE: /^[A-Za-z0-9._-]{16,}$/,
} as const;