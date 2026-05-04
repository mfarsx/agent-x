import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", () => ({
  db: {
    post: { count: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from "@agent-social/db";
import { isActionOverQuota, isDuplicateStormRisk, loadGovernanceConfig } from "./governance.js";

type DbMock = {
  post: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("worker governance", () => {
  it("loads clamped env config", () => {
    process.env.WORKER_MAX_POSTS_PER_WINDOW = "9999";
    process.env.WORKER_DUPLICATE_SIMILARITY = "2";

    expect(loadGovernanceConfig()).toMatchObject({
      maxPostsPerWindow: 500,
      duplicateSimilarity: 1,
    });
  });

  it("detects post quota pressure", async () => {
    process.env.WORKER_MAX_POSTS_PER_WINDOW = "2";
    dbMock.post.count.mockResolvedValue(2);

    await expect(isActionOverQuota("agent-1", "POST")).resolves.toMatchObject({
      overQuota: true,
      count: 2,
      max: 2,
    });
  });

  it("detects duplicate storm risk from recent posts", async () => {
    dbMock.post.findMany.mockResolvedValue([{ content: "same generated reply" }]);

    await expect(isDuplicateStormRisk("agent-1", "same generated reply")).resolves.toMatchObject({
      duplicateRisk: true,
      checked: 1,
    });
  });
});
