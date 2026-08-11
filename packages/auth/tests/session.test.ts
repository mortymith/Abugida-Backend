import { describe, it, expect } from "bun:test";
import { resolveSession, revokeSession, refreshSession } from "../src/core/session";
import type { Auth } from "better-auth";

function fakeAuth(getSessionImpl: () => unknown, signOutImpl: () => unknown = () => undefined): Auth {
  return {
    api: {
      getSession: getSessionImpl,
      signOut: signOutImpl,
    },
  } as unknown as Auth;
}

describe("resolveSession", () => {
  it("returns unauthorized when there is no session", async () => {
    const auth = fakeAuth(() => null);
    const result = await resolveSession(auth, new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unauthorized");
  });

  it("returns session_expired for a session whose expiresAt is in the past", async () => {
    const auth = fakeAuth(() => ({
      session: { id: "s1", userId: "u1", expiresAt: new Date(Date.now() - 1000).toISOString() },
      user: { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null },
    }));
    const result = await resolveSession(auth, new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("session_expired");
  });

  it("returns ok for a valid, unexpired session", async () => {
    const auth = fakeAuth(() => ({
      session: { id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 100_000).toISOString() },
      user: { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null },
    }));
    const result = await resolveSession(auth, new Headers());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.email).toBe("a@example.com");
      expect(result.value.session.id).toBe("s1");
    }
  });

  it("returns session_invalid when the underlying call throws", async () => {
    const auth = fakeAuth(() => {
      throw new Error("db unreachable");
    });
    const result = await resolveSession(auth, new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("session_invalid");
  });
});

describe("refreshSession", () => {
  it("passes disableCookieCache through to the underlying getSession call", async () => {
    let receivedQuery: unknown;
    const auth = fakeAuth((...args: unknown[]) => {
      receivedQuery = (args[0] as { query?: unknown })?.query;
      return {
        session: { id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 100_000).toISOString() },
        user: { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null },
      };
    });

    const result = await refreshSession(auth, new Headers());
    expect(result.ok).toBe(true);
    expect(receivedQuery).toEqual({ disableCookieCache: true });
  });
});

describe("resolveSession logging", () => {
  it("calls logger.debug on a resolved session without leaking user data in the message", async () => {
    const events: Array<{ level: string; message: string }> = [];
    const logger = {
      debug: (message: string) => events.push({ level: "debug", message }),
      info: (message: string) => events.push({ level: "info", message }),
      warn: (message: string) => events.push({ level: "warn", message }),
      error: (message: string) => events.push({ level: "error", message }),
    };
    const auth = fakeAuth(() => ({
      session: { id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 100_000).toISOString() },
      user: { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null },
    }));

    await resolveSession(auth, new Headers(), { logger });
    expect(events.some((e) => e.level === "debug")).toBe(true);
    expect(events.every((e) => !e.message.includes("a@example.com"))).toBe(true);
  });

  it("calls logger.error when session resolution throws", async () => {
    const events: string[] = [];
    const logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: (message: string) => events.push(message),
    };
    const auth = fakeAuth(() => {
      throw new Error("db down");
    });

    await resolveSession(auth, new Headers(), { logger });
    expect(events.length).toBe(1);
  });
});

describe("revokeSession", () => {
  it("returns ok(true) on success", async () => {
    const auth = fakeAuth(
      () => null,
      () => undefined
    );
    const result = await revokeSession(auth, new Headers());
    expect(result).toEqual({ ok: true, value: true });
  });

  it("returns an unknown error if signOut throws", async () => {
    const auth = fakeAuth(
      () => null,
      () => {
        throw new Error("nope");
      }
    );
    const result = await revokeSession(auth, new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unknown");
  });
});
