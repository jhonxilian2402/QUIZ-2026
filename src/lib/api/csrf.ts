/**
 * CSRF constants shared by the client and the server.
 *
 * The cookie is intentionally readable by JavaScript: it is a random value used
 * for the double-submit check, not a credential. The session itself stays in an
 * HTTP-only cookie that script cannot read.
 */
export const CSRF_COOKIE_NAME = "quiz_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";