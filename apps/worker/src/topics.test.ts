import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPostPrompt, extractOverusedTerms, pickTopicForAgent } from "./topics.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickTopicForAgent", () => {
  it("returns a topic from the handle-specific pool when available", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const topic = pickTopicForAgent("koda", [], []);
    expect([
      "small product ideas",
      "internet culture",
      "daily observations",
      "questions for builders",
      "ai agents living with humans",
      "learning notes",
      "creative coding",
      "tools and workflows",
      "music focus routines",
      "weird little thoughts",
    ]).toContain(topic);
  });

  it("uses default pool for unknown handle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const topic = pickTopicForAgent("unknown_handle_xyz", [], []);
    expect(topic).toBe("practical observations");
  });

  it("prefers topics not inferred from recent posts", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const recent = ["I shipped a product idea prototype today"];
    const topic = pickTopicForAgent("koda", recent, []);
    expect(topic).not.toBe("small product ideas");
  });
});

describe("extractOverusedTerms", () => {
  it("returns tokens that appear in at least minCount posts", () => {
    const texts = ["hello world test", "hello again", "world building"];
    const terms = extractOverusedTerms(texts, { minCount: 2, maxTerms: 5 });
    expect(terms).toContain("hello");
    expect(terms).toContain("world");
  });

  it("respects maxTerms ordering by frequency", () => {
    const texts = ["aaa bbb", "aaa bbb", "aaa ccc", "bbb ccc"];
    const terms = extractOverusedTerms(texts, { minCount: 2, maxTerms: 2 });
    expect(terms).toHaveLength(2);
  });
});

describe("buildPostPrompt", () => {
  it("includes topic, persona, and retry hint when provided", () => {
    const prompt = buildPostPrompt({
      topic: "testing habits",
      overusedTerms: ["foo"],
      recentPosts: ["old post content"],
      memories: "remember this",
      persona: "test_bot",
      retryHint: "be shorter",
    });
    expect(prompt).toContain("Persona handle: test_bot");
    expect(prompt).toContain("Selected topic: testing habits");
    expect(prompt).toContain("Avoid these overused themes/terms: foo");
    expect(prompt).toContain("Recent posts");
    expect(prompt).toContain("old post content");
    expect(prompt).toContain("Durable memory context");
    expect(prompt).toContain("remember this");
    expect(prompt).toContain("Retry instruction: be shorter");
  });

  it("omits optional sections when empty", () => {
    const prompt = buildPostPrompt({
      topic: "x",
      overusedTerms: [],
      recentPosts: [],
      memories: "",
    });
    expect(prompt).toContain("Persona handle: unknown");
    expect(prompt).not.toContain("Recent posts");
    expect(prompt).not.toContain("Durable memory");
    expect(prompt).toContain("Avoid repeating recent themes.");
  });
});
