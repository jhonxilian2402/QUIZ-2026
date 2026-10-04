import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, createTestUser, TEST_PASSWORD, loginToken } from "./helpers";

/**
 * Authentication and user isolation.
 *
 * The central security claim of this phase is that one user can never reach
 * another user's data. These cases exercise that at the service boundary that
 * every route delegates to.
 */

before(async () => {
  await freshDatabase();
});

test("register creates an account and a session", async () => {
  const { id, email } = await createTestUser();
  assert.match(id, /^[0-9a-f-]{36}$/, "user id should be a UUID");

  const token = await loginToken(email, TEST_PASSWORD);
  assert.ok(token.length > 20, "a session token is issued");
});

test("duplicate email is rejected as a conflict", async () => {
  const { email } = await createTestUser();
  const { register } = await import("../src/server/services/authService");

  await assert.rejects(
    () =>
      register(
        { email, password: TEST_PASSWORD, displayName: "Copy" },
        { userAgent: null, ip: null }
      ),
    (error: unknown) =>
      (error as { code?: string }).code === "CONFLICT",
    "a second registration with the same email must fail as a conflict"
  );
});

test("login rejects a wrong password without revealing which field was wrong", async () => {
  const { email } = await createTestUser();
  const { login } = await import("../src/server/services/authService");

  await assert.rejects(
    () => login({ email, password: "definitely-not-the-password" }, { userAgent: null, ip: null }),
    (error: unknown) => {
      const appError = error as { code?: string; message?: string };
      assert.equal(appError.code, "UNAUTHORIZED");
      assert.equal(appError.message, "Email or password is incorrect.");
      return true;
    }
  );
});

test("login with an unknown email fails the same way as a wrong password", async () => {
  const { login } = await import("../src/server/services/authService");
  await assert.rejects(
    () =>
      login(
        { email: "nobody@example.test", password: TEST_PASSWORD },
        { userAgent: null, ip: null }
      ),
    (error: unknown) => (error as { code?: string }).code === "UNAUTHORIZED"
  );
});

test("password hashes are never returned by the profile serializer", async () => {
  const { id } = await createTestUser();
  const { getProfile } = await import("../src/server/services/userService");
  const profile = await getProfile(id);

  const serialized = JSON.stringify(profile);
  assert.ok(!("passwordHash" in profile), "profile must not expose passwordHash");
  assert.ok(!serialized.includes("scrypt$"), "no hash material may leak");
});

test("session resolves to the owning user and rejects unknown tokens", async () => {
  const { email, id } = await createTestUser();
  const token = await loginToken(email, TEST_PASSWORD);
  const { resolveSessionUser } = await import("../src/server/services/authService");

  const resolved = await resolveSessionUser(token);
  assert.equal(resolved?.user.id, id);

  assert.equal(await resolveSessionUser("not-a-real-token"), null);
  assert.equal(await resolveSessionUser(null), null);
});

test("logout revokes the session server-side", async () => {
  const { email } = await createTestUser();
  const token = await loginToken(email, TEST_PASSWORD);
  const { resolveSessionUser, logout } = await import(
    "../src/server/services/authService"
  );

  assert.ok(await resolveSessionUser(token));
  await logout(token);
  assert.equal(
    await resolveSessionUser(token),
    null,
    "a revoked token must not resolve, even though the cookie could still be presented"
  );
});

test("a conversation created by one user is invisible to another", async () => {
  const alice = await createTestUser({ displayName: "Alice" });
  const bob = await createTestUser({ displayName: "Bob" });

  const conversationService = await import(
    "../src/server/services/conversationService"
  );

  const conversation = await conversationService.create(alice.id, {
    title: "Alice private notes",
  });

  // Bob must not be able to read it, even knowing the exact id.
  await assert.rejects(
    () => conversationService.getById(bob.id, conversation.id),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND",
    "another user's conversation must resolve to not found"
  );

  // Bob must not be able to modify or delete it either.
  await assert.rejects(
    () => conversationService.update(bob.id, conversation.id, { title: "Hijacked" }),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );
  await assert.rejects(
    () => conversationService.remove(bob.id, conversation.id),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );

  // And it must remain unchanged and still readable by its owner.
  const stillOwned = await conversationService.getById(alice.id, conversation.id);
  assert.equal(stillOwned.title, "Alice private notes");
});

test("conversation listings never include another user's rows", async () => {
  const alice = await createTestUser();
  const bob = await createTestUser();
  const conversationService = await import(
    "../src/server/services/conversationService"
  );

  await conversationService.create(alice.id, { title: "Alice A" });
  await conversationService.create(alice.id, { title: "Alice B" });
  await conversationService.create(bob.id, { title: "Bob only" });

  const aliceList = await conversationService.list(alice.id, { limit: 50 });
  const bobList = await conversationService.list(bob.id, { limit: 50 });

  assert.equal(aliceList.items.length, 2);
  assert.equal(bobList.items.length, 1);
  assert.ok(aliceList.items.every((item) => item.title.startsWith("Alice")));
  assert.equal(bobList.items[0].title, "Bob only");
});

test("messages cannot be read through another user's conversation", async () => {
  const alice = await createTestUser();
  const bob = await createTestUser();
  const conversationService = await import(
    "../src/server/services/conversationService"
  );

  const conversation = await conversationService.create(alice.id, { title: "Private" });
  await conversationService.addMessage(alice.id, conversation.id, {
    role: "user",
    content: "A secret only Alice should see",
  });

  await assert.rejects(
    () => conversationService.listMessagesForConversation(bob.id, conversation.id, { limit: 20 }),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );

  await assert.rejects(
    () =>
      conversationService.addMessage(bob.id, conversation.id, {
        role: "user",
        content: "Injected",
      }),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );

  const aliceMessages = await conversationService.listMessagesForConversation(
    alice.id,
    conversation.id,
    { limit: 20 }
  );
  assert.equal(aliceMessages.items.length, 1);
  assert.ok(aliceMessages.items[0].content.includes("secret"));
});