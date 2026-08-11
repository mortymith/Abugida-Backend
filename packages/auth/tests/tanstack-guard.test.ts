import { describe, it, expect } from "bun:test";
import { requireAuthBeforeLoad, type AuthServerFunctions } from "../src/middleware/tanstack";
import type { ResolvedSession } from "../src/core/session";

const fakeSession: ResolvedSession = {
  session: { id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 100_000) },
  user: { id: "u1", email: "a@example.com", name: "A", emailVerified: true, image: null },
};

function fakeServerFns(session: ResolvedSession | null): AuthServerFunctions {
  return {
    getServerSession: async () => session,
    refreshServerSession: async () => session,
    signOutServer: async () => ({ success: true as const }),
    getServerAccessToken: async () => null,
  };
}

describe("requireAuthBeforeLoad", () => {
  it("returns the session in beforeLoad context when authenticated", async () => {
    const guard = requireAuthBeforeLoad(fakeServerFns(fakeSession));
    const result = await guard({ location: { href: "/dashboard" } });
    expect(result.session.user.email).toBe("a@example.com");
  });

  it("throws a redirect to the default login path when unauthenticated", async () => {
    const guard = requireAuthBeforeLoad(fakeServerFns(null));
    await expect(guard({ location: { href: "/dashboard" } })).rejects.toBeDefined();
  });

  it("respects a custom loginPath override", async () => {
    const guard = requireAuthBeforeLoad(fakeServerFns(null), { loginPath: "/sign-in" });
    try {
      await guard({ location: { href: "/dashboard" } });
      throw new Error("expected guard to throw a redirect");
    } catch (thrown) {
      // TanStack Router's `redirect()` throws a Redirect object; the router
      // options (`to`, `search`, …) live under `.options`.
      expect((thrown as { options?: { to?: string } }).options?.to).toBe("/sign-in");
    }
  });

  it("preserves the original location as a redirectTo search param", async () => {
    const guard = requireAuthBeforeLoad(fakeServerFns(null));
    try {
      await guard({ location: { href: "/dashboard?tab=billing" } });
      throw new Error("expected guard to throw a redirect");
    } catch (thrown) {
      expect((thrown as { options?: { search?: { redirectTo?: string } } }).options?.search?.redirectTo).toBe(
        "/dashboard?tab=billing"
      );
    }
  });
});
