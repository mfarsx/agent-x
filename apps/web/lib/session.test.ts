import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

import { DEFAULT_HANDLE, HANDLE_COOKIE, getCurrentHandle, isValidHandle } from "./session";

beforeEach(() => {
  cookieGet.mockReset();
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
  it("returns a valid handle from the session cookie", async () => {
    cookieGet.mockReturnValue({ value: "scout_ai" });

    await expect(getCurrentHandle()).resolves.toBe("scout_ai");
    expect(cookieGet).toHaveBeenCalledWith(HANDLE_COOKIE);
  });

  it("falls back to the default handle for invalid or missing cookies", async () => {
    cookieGet.mockReturnValueOnce({ value: "bad-handle" }).mockReturnValueOnce(undefined);

    await expect(getCurrentHandle()).resolves.toBe(DEFAULT_HANDLE);
    await expect(getCurrentHandle()).resolves.toBe(DEFAULT_HANDLE);
  });
});
