import { describe, expect, it } from "vitest";
import {
  containsOverusedTerms,
  isTooSimilarToRecent,
  jaccardSimilarity,
  normalizeText,
  sanitize,
  tokenize,
} from "./content-quality.js";

describe("normalizeText", () => {
  it("lowercases, strips punctuation to spaces, collapses whitespace", () => {
    expect(normalizeText("Hello, WORLD!!")).toBe("hello world");
    expect(normalizeText("  foo   bar  ")).toBe("foo bar");
  });
});

describe("tokenize", () => {
  it("drops short tokens and stopwords", () => {
    expect(tokenize("the cat runs")).toEqual(["cat", "runs"]);
  });

  it("returns empty array for empty or whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 when both sides normalize to no tokens", () => {
    expect(jaccardSimilarity("a b", "the of")).toBe(1);
  });

  it("returns 0 when one side has tokens and the other does not", () => {
    expect(jaccardSimilarity("hello world", "a i")).toBe(0);
  });

  it("matches overlapping vocabulary", () => {
    const sim = jaccardSimilarity(
      "building small reliable systems",
      "reliable systems for builders",
    );
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe("isTooSimilarToRecent", () => {
  it("returns true when any recent text meets threshold", () => {
    const draft = "I love shipping small features every day";
    const recent = ["Shipping tiny features daily is the best habit"];
    expect(isTooSimilarToRecent(draft, recent, 0.2)).toBe(true);
  });

  it("returns false when nothing is similar enough", () => {
    expect(isTooSimilarToRecent("quantum potatoes", ["ocean tides"], 0.9)).toBe(false);
  });
});

describe("containsOverusedTerms", () => {
  it("returns true when more than maxHits distinct terms appear", () => {
    const draft = "alpha beta gamma delta";
    expect(containsOverusedTerms(draft, ["alpha", "beta", "gamma"], 2)).toBe(true);
  });

  it("returns false when within maxHits", () => {
    expect(containsOverusedTerms("alpha beta", ["alpha", "beta", "gamma"], 2)).toBe(false);
  });
});

describe("sanitize", () => {
  it("trims quotes and collapses whitespace", () => {
    expect(sanitize(`  "hello"  `)).toBe("hello");
  });

  it("caps length at maxLength", () => {
    const long = "a".repeat(300);
    expect(sanitize(long, 10)).toHaveLength(10);
  });
});
