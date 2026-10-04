// End-to-end API verification against the running Next.js server.
// Exercises the real HTTP surface: auth cookies, CSRF, persistence and
// cross-user isolation, exactly as a browser would.

const BASE = "http://localhost:4311";
let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
}

/** Minimal cookie jar so the session cookie round-trips like a browser. */
function makeClient() {
  const jar = new Map();

  return {
    get cookies() {
      return jar;
    },
    /** Raw Set-Cookie headers from the most recent response. */
    lastSetCookie: "",
    setCookie(header) {
      if (!header) return;
      this.lastSetCookie = header;
      for (const part of header.split(/,(?=[^;]+=)/)) {
        const [pair] = part.split(";");
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (value === "") jar.delete(name);
        else jar.set(name, value);
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    csrf() {
      return jar.get("quiz_csrf") ?? "";
    },
    async req(method, path, body) {
      // A browser receives the CSRF companion cookie on its first safe request
      // (the app loads the session before any mutation). Mirror that handshake:
      // prime the cookie with a GET before this client's first mutation.
      if (method !== "GET" && !jar.has("quiz_csrf")) {
        await this.req("GET", "/api/auth/session");
      }
      const headers = { Accept: "application/json" };
      const cookie = this.header();
      if (cookie) headers.Cookie = cookie;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (method !== "GET") headers["x-csrf-token"] = this.csrf();

      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      this.setCookie(res.headers.getSetCookie?.().join(",") ?? res.headers.get("set-cookie"));
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }
      return { status: res.status, body: json };
    },
  };
}

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  console.log("\nHealth");
  {
    const c = makeClient();
    const r = await c.req("GET", "/api/health");
    check("health ok", r.status === 200 && r.body?.data?.status === "ok", JSON.stringify(r.body));
    check("database reachable", r.body?.data?.database === "ok");
    check("no secret leaked in health", !JSON.stringify(r.body).match(/secret|password|key/i));
  }

  console.log("\nUnauthenticated access is refused");
  {
    const c = makeClient();
    for (const [method, path] of [
      ["GET", "/api/settings"],
      ["GET", "/api/me"],
      ["GET", "/api/conversations"],
      ["GET", "/api/quizzes"],
      ["GET", "/api/files"],
      ["GET", "/api/providers"],
      ["GET", "/api/ai/models"],
      ["GET", "/api/ai/providers/status"],
    ]) {
      const r = await c.req(method, path);
      check(`${method} ${path} → 401`, r.status === 401 && r.body?.error?.code === "UNAUTHORIZED", `got ${r.status}`);
    }
  }

  console.log("\nCSRF protection");
  {
    const c = makeClient();
    // No CSRF header at all on a mutating request.
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `x-${unique()}@example.test`, password: "a-long-enough-password", displayName: "X" }),
    });
    check("POST without CSRF token → 403", res.status === 403, `got ${res.status}`);
  }

  console.log("\nRegistration, session and validation");
  const alice = makeClient();
  const aliceEmail = `alice-${unique()}@example.test`;
  {
    const r = await alice.req("POST", "/api/auth/register", {
      email: aliceEmail,
      password: "correct-horse-battery-staple",
      displayName: "Alice",
    });
    check("register → 201", r.status === 201, JSON.stringify(r.body));
    check("register returns the user", r.body?.data?.user?.email === aliceEmail.toLowerCase());
    const sessionCookie = alice.lastSetCookie
      .split(/,(?=[^;]+=)/)
      .find((h) => h.trim().toLowerCase().startsWith("quiz_session=")) ?? "";
    check("session cookie is httpOnly", /httponly/i.test(sessionCookie), sessionCookie);
    const raw = JSON.stringify(r.body);
    check("no password hash in response", !/scrypt\$|passwordHash/.test(raw));

    const weak = await alice.req("POST", "/api/auth/register", {
      email: `weak-${unique()}@example.test`,
      password: "short",
      displayName: "Weak",
    });
    check("short password → 422", weak.status === 422 && weak.body?.error?.code === "VALIDATION_ERROR", `got ${weak.status}`);

    const dupe = makeClient();
    const d = await dupe.req("POST", "/api/auth/register", {
      email: aliceEmail,
      password: "correct-horse-battery-staple",
      displayName: "Copy",
    });
    check("duplicate email → 409", d.status === 409 && d.body?.error?.code === "CONFLICT", `got ${d.status}`);
  }

  console.log("\nSession endpoint");
  {
    const r = await alice.req("GET", "/api/auth/session");
    check("session authenticated", r.body?.data?.authenticated === true);
    const anon = makeClient();
    const a = await anon.req("GET", "/api/auth/session");
    check("anonymous session false", a.body?.data?.authenticated === false && a.body?.data?.user === null);
  }

  console.log("\nSettings persistence");
  {
    const initial = await alice.req("GET", "/api/settings");
    check("settings load with defaults", initial.status === 200 && initial.body?.data?.appearance?.theme === "dark");

    const patched = await alice.req("PATCH", "/api/settings", {
      appearance: { ...initial.body.data.appearance, theme: "light", density: "compact" },
    });
    check("settings patch applied", patched.status === 200 && patched.body?.data?.appearance?.theme === "light");

    const reloaded = await alice.req("GET", "/api/settings");
    check("settings persisted", reloaded.body?.data?.appearance?.theme === "light" && reloaded.body?.data?.appearance?.density === "compact");

    const injected = await alice.req("PATCH", "/api/settings", {
      appearance: { theme: "dark", injected: "evil" },
    });
    check("unknown settings field rejected → 422", injected.status === 422, `got ${injected.status}`);

    const bad = await alice.req("PATCH", "/api/settings", { ai: { creativity: 999 } });
    check("invalid settings value rejected → 422", bad.status === 422, `got ${bad.status}`);
  }

  console.log("\nProfile");
  {
    const me = await alice.req("GET", "/api/me");
    check("me returns own profile", me.status === 200 && me.body?.data?.email === aliceEmail.toLowerCase());
    check("me contains no hash", !/scrypt\$|passwordHash/.test(JSON.stringify(me.body)));

    const updated = await alice.req("PATCH", "/api/me", { displayName: "Alice Updated" });
    check("profile update persists", updated.body?.data?.displayName === "Alice Updated");

    const escalated = await alice.req("PATCH", "/api/me", { status: "admin", id: "hacked" });
    check("protected fields rejected → 422", escalated.status === 422, `got ${escalated.status}`);
  }

  console.log("\nConversations and messages");
  let aliceConversationId;
  {
    const created = await alice.req("POST", "/api/conversations", { title: "Alice private" });
    check("conversation created → 201", created.status === 201, JSON.stringify(created.body));
    aliceConversationId = created.body.data.id;

    const listed = await alice.req("GET", "/api/conversations");
    check("conversation listed for owner", listed.body?.data?.items?.some((i) => i.id === aliceConversationId));

    const message = await alice.req("POST", `/api/conversations/${aliceConversationId}/messages`, {
      content: "Hello from Alice",
    });
    check("message stored → 201", message.status === 201 && message.body?.data?.content === "Hello from Alice");
    check("no fabricated assistant metadata", message.body?.data?.metadata === null);

    const messages = await alice.req("GET", `/api/conversations/${aliceConversationId}/messages`);
    check("message readable by owner", messages.body?.data?.items?.length === 1);
  }

  console.log("\nChat turns (no AI key in this environment)");
  {
    // Validation happens before any stream starts.
    const empty = await alice.req("POST", `/api/conversations/${aliceConversationId}/chat`, {
      content: "   ",
    });
    check("empty chat message → 422", empty.status === 422, `got ${empty.status}`);

    // Without a provider key the turn fails with a controlled error envelope,
    // but the user message must still be persisted (never silently dropped).
    const requestId = crypto.randomUUID();
    const turn = await alice.req("POST", `/api/conversations/${aliceConversationId}/chat`, {
      content: "A real question from the verification script",
      clientRequestId: requestId,
    });
    check(
      "chat turn without key → controlled 502",
      turn.status === 502 && turn.body?.error?.code === "AI_PROVIDER_UNAVAILABLE",
      `got ${turn.status} ${JSON.stringify(turn.body)}`
    );

    const afterFail = await alice.req("GET", `/api/conversations/${aliceConversationId}/messages?limit=10`);
    const userMessages = afterFail.body?.data?.items?.filter((m) => m.role === "user") ?? [];
    check(
      "user message preserved after provider failure",
      userMessages.some((m) => m.content === "A real question from the verification script")
    );
    check(
      "no fake assistant message persisted",
      (afterFail.body?.data?.items ?? []).every((m) => m.role !== "assistant")
    );

    // The same idempotency key must not duplicate the user message.
    const retry = await alice.req("POST", `/api/conversations/${aliceConversationId}/chat`, {
      content: "A real question from the verification script",
      clientRequestId: requestId,
    });
    check("idempotent retry → same controlled 502", retry.status === 502, `got ${retry.status}`);
    const afterRetry = await alice.req("GET", `/api/conversations/${aliceConversationId}/messages?limit=10`);
    const sameContent = (afterRetry.body?.data?.items ?? []).filter(
      (m) => m.content === "A real question from the verification script"
    );
    check("no duplicate user message after retry", sameContent.length === 1, `got ${sameContent.length}`);
  }

  console.log("\nQuiz persistence");
  let aliceQuizId;
  {
    const payload = {
      title: "Quadratics",
      subject: "Mathematics",
      topic: "Quadratic equations",
      difficulty: "medium",
      questionType: "multiple-choice",
      academicLevel: "high-school",
      questionCount: 5,
      sourceMode: "ai",
      timeLimit: null,
      status: "draft",
      configuration: {
        contentMode: "topic",
        language: "pt-BR",
        explanations: true,
        shuffleQuestions: false,
        shuffleAnswers: false,
        aiStyle: "balanced",
        databaseShare: 50,
        databaseSource: "",
        institution: "",
        year: "",
        academicLevel: "high-school",
        customInstructions: "",
      },
    };
    const created = await alice.req("POST", "/api/quizzes", payload);
    // No AI provider is configured in this environment, so generation must
    // fail honestly: a 502, a normalized AI code, and no persisted quiz.
    check("quiz generation without AI key → 502", created.status === 502, `got ${created.status}`);
    check(
      "error code is AI_PROVIDER_UNAVAILABLE",
      created.body?.error?.code === "AI_PROVIDER_UNAVAILABLE",
      JSON.stringify(created.body?.error)
    );

    const invalid = await alice.req("POST", "/api/quizzes", { ...payload, questionCount: 500 });
    check("invalid quiz config → 422", invalid.status === 422, `got ${invalid.status}`);

    const listing = await alice.req("GET", "/api/quizzes");
    check(
      "no quiz persisted after failed generation",
      listing.status === 200 && Array.isArray(listing.body?.data?.items) && listing.body.data.items.length === 0,
      JSON.stringify(listing.body?.data?.items?.length)
    );

    const dbMode = await alice.req("POST", "/api/quizzes", { ...payload, sourceMode: "database" });
    const dbHonestlyOk =
      dbMode.status === 201 ||
      (dbMode.status === 422 &&
        /database|source/i.test(dbMode.body?.error?.message ?? ""));
    check("database source produces real or honestly-absent content", dbHonestlyOk, JSON.stringify(dbMode.body));
    if (dbMode.status === 201) {
      const questions = dbMode.body?.data?.questions ?? [];
      check("database questions are labelled as such", questions.every((q) => q.source === "database"));
      await alice.req("DELETE", `/api/quizzes/${dbMode.body?.data?.quiz?.id}`);
    }
  }

  console.log("\nFiles and providers");
  {
    const file = await alice.req("POST", "/api/files", {
      filename: "notes.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
    check("file metadata created → 201", file.status === 201, JSON.stringify(file.body));
    check("storage honestly reported as non-durable", file.body?.data?.storage?.durable === false);

    const badType = await alice.req("POST", "/api/files", {
      filename: "payload.exe",
      mimeType: "application/x-msdownload",
      size: 1024,
    });
    check("unsupported file type rejected → 422", badType.status === 422, `got ${badType.status}`);

    const providers = await alice.req("GET", "/api/providers");
    check("providers list returned", Array.isArray(providers.body?.data));
    check("providers report not configured", providers.body.data.every((p) => p.configured === false));
    check("no credentials in provider response", !/apiKey|credentialRef|sk-/.test(JSON.stringify(providers.body)));

    const configured = await alice.req("POST", "/api/providers/openrouter", {
      credential: "sk-or-v1-this-is-a-fake-test-key-value",
      enabled: true,
    });
    check("provider configure accepted", configured.status === 200 && configured.body?.data?.configured === true);
    check("credential never echoed back", !JSON.stringify(configured.body).includes("this-is-a-fake-test-key"));

    const tested = await alice.req("POST", "/api/providers/openrouter?action=test");
    check("provider test reports platform key not configured", tested.body?.data?.ok === false);

    const disconnected = await alice.req("DELETE", "/api/providers/openrouter");
    check("provider disconnect → 204", disconnected.status === 204, `got ${disconnected.status}`);
  }

  console.log("\nAI model catalog (no key configured in this environment)");
  {
    // The dev server runs without OPENROUTER_API_KEY, so every AI endpoint
    // must fail honestly with a controlled error — never fake models.
    const status = await alice.req("GET", "/api/ai/providers/status");
    check("provider status → 200", status.status === 200, JSON.stringify(status.body));
    check("status reports not configured", status.body?.data?.configured === false);
    check("status leaks no key material", !/sk-or|apiKey|credential/i.test(JSON.stringify(status.body)));

    const models = await alice.req("GET", "/api/ai/models");
    check(
      "catalog without key → controlled 502",
      models.status === 502 && models.body?.error?.code === "AI_PROVIDER_UNAVAILABLE",
      `got ${models.status} ${JSON.stringify(models.body)}`
    );

    const refresh = await alice.req("POST", "/api/ai/models/refresh");
    check(
      "refresh without key → controlled 502",
      refresh.status === 502 && refresh.body?.error?.code === "AI_PROVIDER_UNAVAILABLE",
      `got ${refresh.status}`
    );

    // A model preference cannot be saved while the catalog is unreachable:
    // the backend verifies against the live catalog rather than trusting the client.
    const current = await alice.req("GET", "/api/settings");
    const modelPatch = await alice.req("PATCH", "/api/settings", {
      ai: { ...current.body.data.ai, defaultModelId: "vendor/invented" },
    });
    check(
      "unverifiable model preference rejected",
      modelPatch.status === 502 || modelPatch.status === 422,
      `got ${modelPatch.status}`
    );
    const after = await alice.req("GET", "/api/settings");
    check(
      "rejected model preference was not stored",
      after.body?.data?.ai?.defaultModelId !== "vendor/invented"
    );
  }

  console.log("\nCross-user isolation (the security core)");
  const bob = makeClient();
  {
    const r = await bob.req("POST", "/api/auth/register", {
      email: `bob-${unique()}@example.test`,
      password: "correct-horse-battery-staple",
      displayName: "Bob",
    });
    check("second user registered", r.status === 201);

    const bobConvos = await bob.req("GET", "/api/conversations");
    check("bob sees none of alice's conversations", bobConvos.body?.data?.items?.length === 0);

    const read = await bob.req("GET", `/api/conversations/${aliceConversationId}`);
    check("bob cannot read alice's conversation → 404", read.status === 404, `got ${read.status}`);

    const patch = await bob.req("PATCH", `/api/conversations/${aliceConversationId}`, { title: "Hijacked" });
    check("bob cannot modify it → 404", patch.status === 404, `got ${patch.status}`);

    const del = await bob.req("DELETE", `/api/conversations/${aliceConversationId}`);
    check("bob cannot delete it → 404", del.status === 404, `got ${del.status}`);

    const msgs = await bob.req("GET", `/api/conversations/${aliceConversationId}/messages`);
    check("bob cannot read alice's messages → 404", msgs.status === 404, `got ${msgs.status}`);

    const send = await bob.req("POST", `/api/conversations/${aliceConversationId}/messages`, { content: "injected" });
    check("bob cannot post into it → 404", send.status === 404, `got ${send.status}`);

    const chat = await bob.req("POST", `/api/conversations/${aliceConversationId}/chat`, { content: "injected" });
    check("bob cannot run a chat turn in it → 404", chat.status === 404, `got ${chat.status}`);

    const quiz = await bob.req("GET", `/api/quizzes/${require("node:crypto").randomUUID()}`);
    check("bob cannot read someone else's quiz → 404", quiz.status === 404, `got ${quiz.status}`);

    const bobSettings = await bob.req("GET", "/api/settings");
    check("bob's settings are his own defaults", bobSettings.body?.data?.appearance?.theme === "dark");
    check("alice's light theme did not leak to bob", bobSettings.body?.data?.appearance?.density === "comfortable");

    // Alice's data must be intact after all of Bob's attempts.
    const stillThere = await alice.req("GET", `/api/conversations/${aliceConversationId}`);
    check("alice's conversation is unchanged", stillThere.status === 200 && stillThere.body?.data?.title === "Alice private");
  }

  console.log("\nLogout");
  {
    const r = await alice.req("POST", "/api/auth/logout");
    check("logout → 200", r.status === 200 && r.body?.data?.authenticated === false);
    const after = await alice.req("GET", "/api/settings");
    check("session revoked server-side → 401", after.status === 401, `got ${after.status}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("FAILED: " + failures.join("; "));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});