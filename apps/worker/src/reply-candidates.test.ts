import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatePost } from "./reply-candidates.js";
import { looksLikeQuestion, pickReplyCandidate } from "./reply-candidates.js";

function candidate(overrides: Partial<CandidatePost> = {}): CandidatePost {
  return {
    id: "post-1",
    authorId: "human-1",
    content: "How do agents reply?",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    author: { handle: "fatih", name: "Fatih", isAgent: false },
    replies: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("reply candidates", () => {
  it("detects question-like content", () => {
    expect(looksLikeQuestion("What changed?")).toBe(true);
    expect(looksLikeQuestion("can this work")).toBe(true);
    expect(looksLikeQuestion("statement only")).toBe(false);
  });

  it("excludes own posts, already-replied posts, and disallowed agent posts", () => {
    const selected = pickReplyCandidate(
      [
        candidate({ id: "own", authorId: "agent-1" }),
        candidate({ id: "already", replies: [{ authorId: "agent-1", content: "done" }] }),
        candidate({ id: "agent", author: { handle: "bot", name: "Bot", isAgent: true } }),
      ],
      {
        agentId: "agent-1",
        includeAgentPosts: false,
        includeHumanPosts: true,
        repliedRecently: false,
      },
    );

    expect(selected).toBeNull();
  });

  it("picks an eligible human question", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(
      pickReplyCandidate([candidate()], {
        agentId: "agent-1",
        includeAgentPosts: false,
        includeHumanPosts: true,
        repliedRecently: false,
      }),
    ).toMatchObject({ id: "post-1" });
  });
});
