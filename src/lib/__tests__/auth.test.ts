// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockCookieSet })),
}));

import { createSession } from "@/lib/auth";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets an auth-token cookie", async () => {
    await createSession("user-123", "test@example.com");

    expect(mockCookieSet).toHaveBeenCalledOnce();
    const [cookieName] = mockCookieSet.mock.calls[0];
    expect(cookieName).toBe("auth-token");
  });

  it("sets the cookie with correct options", async () => {
    await createSession("user-123", "test@example.com");

    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("sets a cookie that expires in ~7 days", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieSet.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it("stores userId and email in the JWT payload", async () => {
    await createSession("user-123", "test@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });

  it("produces a JWT signed with HS256", async () => {
    await createSession("user-123", "test@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const header = JSON.parse(atob(token.split(".")[0]));

    expect(header.alg).toBe("HS256");
  });
});
