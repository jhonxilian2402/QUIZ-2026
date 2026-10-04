# Quiz AI Workspace

An AI study workspace: chat, quiz building and personalization, built as a
single Next.js application with a real API, database and authentication
foundation.

## Status

All 12 phases are implemented. Highlights:

- Phase 9 (real question database + real-time web research) is complete.
  "database"-sourced questions come from a real, external question-bank API
  (OpenTDB by default, configurable via `QUESTION_DB_BASE_URL`), "web"-sourced
  questions are composed by the AI strictly from freshly retrieved web material
  (Wikipedia by default, configurable via `WEB_RESEARCH_BASE_URL`) and "mixed"
  quizzes always include real database/web questions when selected. Every
  question carries its true `source` (`ai` | `database` | `web` | `file`) and
  provenance metadata. When a source is unreachable, generation fails honestly
  rather than silently substituting another source.

- Phase 8 (real quiz engine) is complete. Quiz configuration → AI question
  generation (structured output, validated, deduplicated) → persistence →
  timed, server-graded attempts → results, explanations and attempt history
  are all real, with ownership enforced server-side and correctness never
  decided by the client.

- Phase 7 (real AI chat) is complete.

- Phase 10 (real file pipeline) is complete. Uploaded files are validated
  (size, extension, magic bytes), stored through the storage provider,
  processed into normalized page-aware chunks (PDF/TXT/DOCX/PPTX text
  extraction, OCR for images when enabled), made searchable, and used as
  grounded, citation-bearing context for both chat and quiz generation.

- Phase 11 (hardening) is complete. AI circuit breaker, quiz-generation
  duplicate guard, JSON body size caps, SSRF guard on outbound fetches,
  production HSTS, refreshed dependency audit, and a security regression suite.

- Phase 12 (final QA/release) is complete — see the production sections below.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| API | Next.js Route Handlers under `/api` |
| Database | PostgreSQL via Drizzle ORM |
| Local database | PGlite — real PostgreSQL compiled to WASM, no server required |
| Validation | Zod, shared between server and client |
| Tests | `node:test` with `tsx` |

The schema, SQL, enums and constraints are genuine PostgreSQL. Pointing at a
hosted Postgres later means setting `DATABASE_URL`; the layer above it does not
change.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux

# 3. Generate an auth secret and put it in .env as AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 4. Start the application (migrations apply automatically on first request)
npm run dev
```

The app runs at <http://localhost:4311>. The first request creates the embedded
database at `.data/pglite` and applies every migration.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | Type check with `tsc --noEmit` |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the backend test suite |
| `npm run db:generate` | Create a migration from schema changes |
| `npm run db:migrations` | Regenerate the typed migrations module after `db:generate` |
| `npm run db:reset` | Delete the local embedded database |

### Changing the schema

```bash
# edit src/server/db/schema.ts, then:
npm run db:generate -- --name=add_something
npm run db:migrations
```

`drizzle/*.sql` is the source of truth and is what a PostgreSQL deployment
applies. `npm run db:migrations` converts those same statements into the module
the embedded database executes, so both paths stay identical.

## Configuration

All variables are documented in `.env.example`. Configuration is validated when
the server starts; a missing required variable fails fast with a message naming
the variable, never its value.

`AUTH_SECRET` is required outside development and test.

`OPENROUTER_API_KEY` is server-only: it lives in the environment, is read by a
single centralized client (`src/server/providers/openrouter/client.ts`) and is
never sent to the browser, logged, or returned by any endpoint. Without it the
application still runs; AI endpoints answer with a controlled
`AI_PROVIDER_UNAVAILABLE`. Related knobs: `OPENROUTER_BASE_URL`,
`OPENROUTER_TIMEOUT_MS`, `OPENROUTER_MAX_RETRIES`, `AI_MODEL_CACHE_TTL_MS`,
`AI_DEFAULT_MODEL`.

## Architecture

```
frontend components
      │  typed services (src/lib/api/services.ts)
      ▼
API client (src/lib/api/client.ts)  ── envelope, CSRF, cancellation
      │
      ▼
route handlers (src/app/api/**)      ── validate → authorize → call service
      │
      ├── services (src/server/services)      business logic
      ├── repositories (src/server/repositories)   database access, user-scoped
      ├── db (src/server/db)                  schema, client, migrations
      └── providers / storage                 vendor-neutral boundaries
```

### Boundaries kept deliberately open

- `AIProvider` + registry, with `AIService` above it. The application never
  imports a vendor SDK; OpenRouter is one registration
  (`src/server/providers/openrouter/`), isolated behind
  `AIService` → `AIProvider` → `OpenRouterClient`.
- `ModelCatalogService` owns dynamic model discovery: the catalog is fetched
  from OpenRouter, validated with schemas, normalized, cached with a TTL and
  served stale when a refresh fails. Free status is derived from live pricing,
  never from model names.
- `QuizGenerator`, `ResearchProvider`, `FileProcessor` and `StorageProvider`
  remain open boundaries for later phases.

### Security model

- Sessions use random opaque tokens in HTTP-only cookies; only a keyed hash is
  stored, so a database disclosure does not yield usable sessions.
- Passwords are hashed with scrypt and compared in constant time.
- CSRF uses the double-submit pattern on state-changing requests.
- Every user-owned query is scoped by `userId` in the repository, so one user can
  never read another's data — including attempts to answer a question from an
  unrelated quiz.
- Quiz correctness and scoring are computed server-side; client claims about
  `isCorrect` are rejected by a strict schema.
- Provider credentials are converted to an opaque reference before storage and
  are never returned by any endpoint.
- Errors are classified; internal detail is logged with a request id and never
  returned to clients.
- Rate limits are applied per client for login, registration and mutations.

This establishes the foundation. It is not a substitute for a dedicated security
audit, which belongs to a later phase.

## API

All responses use a single envelope:

```jsonc
// success
{ "data": { } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {}, "requestId": "…" } }
```

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness; unauthenticated |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Session cookie set/cleared |
| GET | `/api/auth/session` | Who the caller is |
| POST | `/api/auth/password-reset`, `/api/auth/password-reset/confirm` | Token stored hashed, single use |
| GET/PATCH | `/api/me` | Own profile only |
| GET/PATCH | `/api/settings`, POST `/api/settings/reset` | Own settings document |
| GET/POST | `/api/conversations` | Own conversations, paginated and searchable |
| GET/PATCH/DELETE | `/api/conversations/:id` | Ownership enforced |
| GET/POST | `/api/conversations/:id/messages` | Cursor pagination |
| POST | `/api/conversations/:id/chat` | A full chat turn over SSE: persists the user message, streams the assistant reply, persists the result |
| GET/POST | `/api/quizzes` | Real AI generation; validated questions persisted in one write |
| GET/PATCH/DELETE | `/api/quizzes/:id` | |
| GET/POST | `/api/quizzes/:id/attempts` | Time deadline set server-side from `timeLimit` |
| GET | `/api/attempts/:id` | Correct answers withheld while in progress; revealed once completed or expired |
| POST | `/api/attempts/:id/answers`, `/api/attempts/:id/complete` | Server decides correctness and score; expiry enforced |
| GET/POST | `/api/files`, GET/DELETE `/api/files/:id` | Multipart upload, real extraction; soft delete |
| POST | `/api/files/:id/retry`, GET `/api/files/:id/content` | Reprocessing with conflict guard; paginated text |
| POST | `/api/files/search` | Owner-scoped chunk search |
| GET | `/api/providers`, POST/DELETE `/api/providers/:provider` | Never returns credentials |
| GET | `/api/ai/models` | Normalized catalog; filters: `freeOnly`, `vision`, `streaming`, `toolCalling`, `structuredOutput`, `minContext` |
| POST | `/api/ai/models/refresh` | Forces catalog revalidation (rate-limited) |
| GET | `/api/ai/providers/status` | Aggregated provider health; no credential material |

The AI endpoints require authentication. Model preferences saved through
`PATCH /api/settings` (`ai.defaultModelId`, `ai.fallbackModelId`,
`chat.defaultModelId`, `api.openRouter*ModelId`) are verified against the live
catalog; an unknown or unavailable model is rejected with `422`, and an
unreachable provider with `502 AI_PROVIDER_UNAVAILABLE`. AI failures use
normalized error codes: `AI_PROVIDER_UNAVAILABLE`, `AI_AUTHENTICATION_FAILED`,
`AI_MODEL_UNAVAILABLE`, `AI_RATE_LIMITED`, `AI_REQUEST_TIMEOUT`,
`AI_INVALID_REQUEST`, `AI_CONTENT_ERROR`, `AI_CONTEXT_TOO_LARGE`,
`AI_UNKNOWN_ERROR`.

### Chat turns

`POST /api/conversations/:id/chat` accepts `{ content, clientRequestId?,
model? }` and answers with `text/event-stream` frames — `start`, `delta`,
`usage`, `complete`, `error` — matching the shared `ChatStreamEvent` contract.
Guarantees enforced by `chatService`:

- the user message is persisted before any provider call, so provider failure
  never loses user input;
- `clientRequestId` is the idempotency key: a retried send replays the stored
  result instead of duplicating the turn, and retrying a failed turn replaces
  the partial instead of stacking messages;
- one active generation per conversation (`409` otherwise);
- context is selected within a token budget (`AI_CONTEXT_TOKEN_BUDGET`,
  capped by the model's own context length) and overages fail with
  `AI_CONTEXT_TOO_LARGE`;
- model precedence is request override → conversation model → user preference
  → automatic resolution, always catalog-verified;
- client disconnects abort the provider request; partial output is persisted
  marked `cancelled`/`failed` with `partial: true`, never as a success;
- generation parameters come from real settings (creativity → temperature,
  response style → system prompt, length preference → max tokens, streaming
  preference → delivery mode).

## Data model

`users`, `user_settings`, `sessions`, `password_reset_tokens`,
`conversations`, `messages`, `quizzes`, `quiz_questions`, `quiz_attempts`,
`quiz_answers`, `uploaded_files`, `api_provider_configurations`.

UUID primary keys, cascading foreign keys, database enums for every closed set,
and indexes only for real access patterns.

## Production

```bash
npm ci                     # reproducible install from package-lock.json
npm run build              # clean production build
npm start                  # serve on port 4311
```

Required for a real deployment:

- `NODE_ENV=production`
- `AUTH_SECRET` — long random value (32+ chars)
- `APP_URL` — public origin, e.g. `https://app.example.com`
- `DATABASE_URL` — a real PostgreSQL connection string (PGlite is for
  development only; the same Drizzle migrations run against it)
- `OPENROUTER_API_KEY` — server-only; never bundled into frontend assets

Storage:

- default is the local filesystem under `STORAGE_DIR`. On ephemeral platforms
  this directory is lost on redeploy — point the deployment at persistent disk
  or replace `src/server/storage/storageProvider.ts` with an object-storage
  implementation (the rest of the app only talks to the `StorageProvider`
  interface).

OCR:

- set `OCR_ENABLED=true` (default) and ensure the runtime can download the
  tesseract language data; where OCR is impossible for a kind, the file's
  status/limitation is reported honestly rather than fabricated.

Health:

- `GET /api/health` returns `{ status, database }` without secrets.

## Testing

```bash
npm test
```

Covers authentication, authorization, cross-user isolation, validation,
settings persistence, quiz scoring, chat persistence, AI provider mocking,
file upload/extraction/search, mixed-source quiz generation, security
regression (IDOR, prompt injection, SSRF guard, JSON caps, circuit breaker,
duplicate-generation lock) and source-honesty checks. Each case runs against a
fresh in-memory database.

Two additional verification scripts exercise the real runtime:

```bash
# Applies the committed migrations to a scratch file-backed database and
# asserts tables, enums, indexes and constraints exist as the schema claims.
node --import tsx verify-db.cjs

# End-to-end HTTP checks against the running dev server (npm run dev): auth
# cookies, CSRF, persistence and cross-user isolation, as a browser would.
node verify-api.cjs
```
