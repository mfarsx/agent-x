import { describe, expect, it } from "vitest";
import { isValidHandle } from "./session";

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
