import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "./client";
import { getLatestFeed, getThread } from "./feed";
import { createPostAsHandle, createReplyAsHandle, toggleLike, toggleRepost } from "./post";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1";
const describeIntegration = runIntegration ? describe : describe.skip;

const testRunId = `itest_${Date.now()}`;
const authorHandle = `${testRunId}_author`;
const viewerHandle = `${testRunId}_viewer`;

async function deleteIntegrationUsers() {
  await db.user.deleteMany({
    where: {
      handle: { in: [authorHandle, viewerHandle] },
    },
  });
}

describeIntegration("db integration: social flow", () => {
  beforeAll(async () => {
    await deleteIntegrationUsers();
    await db.user.createMany({
      data: [
        {
          email: `${authorHandle}@example.local`,
          handle: authorHandle,
          name: "Integration Author",
          displayName: "Integration Author",
        },
        {
          email: `${viewerHandle}@example.local`,
          handle: viewerHandle,
          name: "Integration Viewer",
          displayName: "Integration Viewer",
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteIntegrationUsers();
    await db.$disconnect();
  });

  it("creates a post, replies, toggles engagement, and reads feed/thread state", async () => {
    const post = await createPostAsHandle(authorHandle, " integration parent post ");
    const reply = await createReplyAsHandle(viewerHandle, post.id, " integration reply ");

    await expect(toggleLike(viewerHandle, post.id)).resolves.toEqual({ active: true, count: 1 });
    await expect(toggleRepost(viewerHandle, post.id)).resolves.toEqual({ active: true, count: 1 });

    const feed = await getLatestFeed({ viewerHandle, searchQuery: "integration parent", limit: 5 });
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({
      id: post.id,
      content: "integration parent post",
      author: { handle: authorHandle },
      counts: { likes: 1, reposts: 1, replies: 1 },
      viewer: { liked: true, reposted: true },
    });

    const thread = await getThread(post.id, { viewerHandle });
    expect(thread).toMatchObject({
      parent: null,
      post: {
        id: post.id,
        counts: { likes: 1, reposts: 1, replies: 1 },
        viewer: { liked: true, reposted: true },
      },
      replies: [
        {
          id: reply.id,
          kind: "REPLY",
          content: "integration reply",
          author: { handle: viewerHandle },
        },
      ],
    });

    await expect(toggleLike(viewerHandle, post.id)).resolves.toEqual({ active: false, count: 0 });
    await expect(toggleRepost(viewerHandle, post.id)).resolves.toEqual({ active: false, count: 0 });
  });
});
