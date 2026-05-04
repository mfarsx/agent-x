import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();
const getServerSession = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("./auth", () => ({
  authOptions: {},
}));

import {
  DEFAULT_HANDLE,
  HANDLE_COOKIE,
  getCurrentActor,
  getCurrentHandle,
  getCurrentViewer,
  isDemoIdentityEnabled,
  isValidHandle,
} from "./session";

beforeEach(() => {
  cookieGet.mockReset();
  getServerSession.mockReset();
  delete process.env.ENABLE_DEMO_IDENTITY;
});

describe("isValidHandle", () => {
  it("accepts alphanumerics and underscores up to 32 chars", () => {
    expect(isValidHandle("fatih")).toBe(true);
    expect(isValidHandle("scout_ai")).toBe(true);
    expect(isValidHandle("a")).toBe(true);
    expect(isValidHandle("a".repeat(32))).toBe(true);
  });

  it("rejects empty, oversize, or non-string values", () => {
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("a".repeat(33))).toBe(false);
    expect(isValidHandle(undefined)).toBe(false);
    expect(isValidHandle(null)).toBe(false);
    expect(isValidHandle(42)).toBe(false);
  });

  it("rejects handles with disallowed characters", () => {
    expect(isValidHandle("foo bar")).toBe(false);
    expect(isValidHandle("foo-bar")).toBe(false);
    expect(isValidHandle("foo.bar")).toBe(false);
    expect(isValidHandle("foo@bar")).toBe(false);
  });
});

describe("getCurrentHandle", () => {
  it("prefers an Auth.js session handle", async () => {
    getServerSession.mockResolvedValue({ user: { handle: "auth_user" } });
    cookieGet.mockReturnValue({ value: "scout_ai" });

    await expect(getCurrentActor()).resolves.toEqual({ handle: "auth_user", source: "auth" });
    await expect(getCurrentHandle()).resolves.toBe("auth_user");
    await expect(getCurrentViewer()).resolves.toEqual({
      handle: "auth_user",
      authenticated: true,
    });
  });

  it("returns a valid handle from the session cookie", async () => {
    getServerSession.mockResolvedValue(null);
    cookieGet.mockReturnValue({ value: "scout_ai" });

    await expect(getCurrentHandle()).resolves.toBe("scout_ai");
    expect(cookieGet).toHaveBeenCalledWith(HANDLE_COOKIE);
  });

  it("falls back to the default handle for invalid or missing cookies", async () => {
    getServerSession.mockResolvedValue(null);
    cookieGet.mockReturnValueOnce({ value: "bad-handle" }).mockReturnValueOnce(undefined);

    await expect(getCurrentHandle()).resolves.toBe(DEFAULT_HANDLE);
    await expect(getCurrentHandle()).resolves.toBe(DEFAULT_HANDLE);
  });

  it("disables demo identity in production or with explicit env", async () => {
    getServerSession.mockResolvedValue(null);
    process.env.ENABLE_DEMO_IDENTITY = "0";

    expect(isDemoIdentityEnabled()).toBe(false);
    await expect(getCurrentActor()).resolves.toBeNull();
    await expect(getCurrentHandle()).resolves.toBe(DEFAULT_HANDLE);
    await expect(getCurrentViewer()).resolves.toEqual({
      handle: DEFAULT_HANDLE,
      authenticated: false,
    });
    expect(cookieGet).not.toHaveBeenCalled();
  });
});
