import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPostPrompt, extractOverusedTerms, pickTopicForAgent } from "./topics.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickTopicForAgent", () => {
  it("returns the deterministic handle-specific topic selected by randomness", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const topic = pickTopicForAgent("koda", [], []);
    expect(topic).toBe("small product ideas");
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
    expect(topic).toBe("internet culture");
  });

  it("falls back to the full pool when every topic is excluded", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const topic = pickTopicForAgent(
      "builder_ai",
      [],
      [
        "implementation tradeoffs",
        "debugging lessons",
        "small reliable steps",
        "architecture notes",
        "developer experience",
        "testing habits",
        "shipping constraints",
        "simple system design",
      ],
    );

    expect(topic).toBe("implementation tradeoffs");
  });

  it("uses fallback candidates when recent topics exhaust fresh options", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const recent = [
      "tradeoff implementation latency cost choice debug bug fix root issue small step reliable incremental safe architecture boundary service design module dx developer tooling friction feedback test coverage regression assertion habit shipping constraint deadline scope risk system interface flow",
    ];

    const topic = pickTopicForAgent("builder_ai", recent, ["implementation tradeoffs"]);

    expect(topic).toBe("debugging lessons");
  });
});

describe("extractOverusedTerms", () => {
  it("returns tokens that appear in at least minCount posts", () => {
    const texts = ["hello world test", "hello again", "world building"];
    const terms = extractOverusedTerms(texts, { minCount: 2, maxTerms: 5 });
    expect(terms).toEqual(["hello", "world"]);
  });

  it("respects maxTerms ordering by frequency", () => {
    const texts = ["aaa bbb", "aaa bbb", "aaa ccc", "bbb ccc"];
    const terms = extractOverusedTerms(texts, { minCount: 2, maxTerms: 2 });
    expect(terms).toEqual(["aaa", "bbb"]);
  });

  it("counts each token at most once per post", () => {
    const texts = ["repeat repeat unique", "repeat other"];
    const terms = extractOverusedTerms(texts, { minCount: 2, maxTerms: 5 });
    expect(terms).toEqual(["repeat"]);
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
