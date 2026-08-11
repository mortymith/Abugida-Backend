import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import {
  withSession,
  requireSession,
  csrfProtection,
  mountAuthRoutes,
  type HonoAuthVariables,
} from "../src/middleware/hono";
import type { AuthInstance } from "../src/core/auth";
import { noopLogger } from "../src/core/logger";
import { ok, err } from "../src/core/types";

const fakeUser = { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null };
const fakeSession = { id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 100_000) };

function fakeAuthInstance(overrides: Partial<AuthInstance> = {}): AuthInstance {
  return {
    raw: {} as never,
    getSession: async () => ok({ session: fakeSession, user: fakeUser }),
    refreshSession: async () => ok({ session: fakeSession, user: fakeUser }),
    signOut: async () => ok(true as const),
    getAccessToken: async () => err({ kind: "provider_error", providerId: "google", message: "n/a" }),
    config: { cors: { origins: ["https://app.abugida.com"] } } as never,
    logger: noopLogger,
    ...overrides,
  };
}

describe("withSession", () => {
  it("sets user/session on context when a session resolves", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono<{ Variables: HonoAuthVariables }>();
    app.use("*", withSession(auth));
    app.get("/", (c) => c.json({ user: c.get("user") }));

    const res = await app.request("/");
    const body = await res.json();
    expect(body.user.email).toBe("a@example.com");
  });

  it("sets null user/session when unauthenticated, without rejecting the request", async () => {
    const auth = fakeAuthInstance({ getSession: async () => err({ kind: "unauthorized", message: "no session" }) });
    const app = new Hono<{ Variables: HonoAuthVariables }>();
    app.use("*", withSession(auth));
    app.get("/", (c) => c.json({ user: c.get("user") }));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });
});

describe("requireSession", () => {
  it("allows the request through when authenticated", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono<{ Variables: HonoAuthVariables }>();
    app.get("/me", requireSession(auth), (c) => c.json({ user: c.get("user") }));

    const res = await app.request("/me");
    expect(res.status).toBe(200);
  });

  it("returns 401 with a structured error body when unauthenticated", async () => {
    const auth = fakeAuthInstance({ getSession: async () => err({ kind: "session_expired", message: "expired" }) });
    const app = new Hono<{ Variables: HonoAuthVariables }>();
    app.get("/me", requireSession(auth), (c) => c.json({ user: c.get("user") }));

    const res = await app.request("/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.kind).toBe("session_expired");
  });

  it("reuses a session already resolved by withSession instead of calling getSession twice", async () => {
    let calls = 0;
    const auth = fakeAuthInstance({
      getSession: async () => {
        calls += 1;
        return ok({ session: fakeSession, user: fakeUser });
      },
    });
    const app = new Hono<{ Variables: HonoAuthVariables }>();
    app.use("*", withSession(auth));
    app.get("/me", requireSession(auth), (c) => c.json({ user: c.get("user") }));

    await app.request("/me");
    expect(calls).toBe(1);
  });
});

describe("csrfProtection", () => {
  it("allows a mutating request from a trusted origin", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono();
    app.post("/danger", csrfProtection(auth), (c) => c.json({ ok: true }));

    const res = await app.request("/danger", { method: "POST", headers: { origin: "https://app.abugida.com" } });
    expect(res.status).toBe(200);
  });

  it("rejects a mutating request from an untrusted origin with 403", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono();
    app.post("/danger", csrfProtection(auth), (c) => c.json({ ok: true }));

    const res = await app.request("/danger", { method: "POST", headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("does not block GET requests regardless of origin", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono();
    app.get("/safe", csrfProtection(auth), (c) => c.json({ ok: true }));

    const res = await app.request("/safe", { headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(200);
  });
});

describe("mountAuthRoutes session refresh endpoint", () => {
  it("returns the refreshed session on a trusted-origin POST", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono<{ Bindings: Record<string, unknown>; Variables: HonoAuthVariables }>();
    mountAuthRoutes(app, auth);

    const res = await app.request("/auth/session/refresh", {
      method: "POST",
      headers: { origin: "https://app.abugida.com" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("a@example.com");
  });

  it("rejects the refresh endpoint from an untrusted origin", async () => {
    const auth = fakeAuthInstance();
    const app = new Hono<{ Bindings: Record<string, unknown>; Variables: HonoAuthVariables }>();
    mountAuthRoutes(app, auth);

    const res = await app.request("/auth/session/refresh", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when the refreshed session is invalid", async () => {
    const auth = fakeAuthInstance({
      refreshSession: async () => err({ kind: "session_invalid", message: "invalid" }),
    });
    const app = new Hono<{ Bindings: Record<string, unknown>; Variables: HonoAuthVariables }>();
    mountAuthRoutes(app, auth);

    const res = await app.request("/auth/session/refresh", {
      method: "POST",
      headers: { origin: "https://app.abugida.com" },
    });
    expect(res.status).toBe(401);
  });
});
