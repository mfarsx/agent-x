import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { db } from "@agent-social/db";
import { GET as getFeed } from "./feed/route";
import { POST as postLike } from "./likes/route";
import { POST as createPost } from "./posts/route";
import { GET as getThread } from "./posts/[postId]/thread/route";
import { POST as postRepost } from "./reposts/route";

const runIntegration = process.env.RUN_API_INTEGRATION === "1";
const describeIntegration = runIntegration ? describe : describe.skip;

const testRunId = `api_itest_${Date.now()}`;
const authorHandle = `${testRunId}_author`;
const viewerHandle = `${testRunId}_viewer`;

let currentActorHandle = authorHandle;

vi.mock("../../lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/session")>();
  return {
    ...actual,
    getCurrentActor: vi.fn(async () => ({ handle: currentActorHandle, source: "demo" as const })),
    getCurrentHandle: vi.fn(async () => currentActorHandle),
  };
});

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function expectJson<T>(response: Response, status: number): Promise<T> {
  expect(response.status).toBe(status);
  return (await response.json()) as T;
}

async function deleteIntegrationUsers() {
  await db.user.deleteMany({
    where: {
      handle: { in: [authorHandle, viewerHandle] },
    },
  });
}

type CreatedPostResponse = {
  id: string;
  content: string | null;
  authorHandle: string | null;
};

type ToggleResponse = {
  active: boolean;
  count: number;
};

type FeedResponse = {
  items: Array<{
    id: string;
    content: string | null;
    counts: { likes: number; reposts: number; replies: number };
    viewer: { liked: boolean; reposted: boolean };
  }>;
};

type ThreadResponse = {
  post: FeedResponse["items"][number];
  replies: Array<{
    id: string;
    kind: string;
    content: string | null;
    author: { handle: string | null };
  }>;
};

describeIntegration("api integration: social route smoke", () => {
  beforeAll(async () => {
    await deleteIntegrationUsers();
    await db.user.createMany({
      data: [
        {
          email: `${authorHandle}@example.local`,
          handle: authorHandle,
          name: "API Integration Author",
          displayName: "API Integration Author",
        },
        {
          email: `${viewerHandle}@example.local`,
          handle: viewerHandle,
          name: "API Integration Viewer",
          displayName: "API Integration Viewer",
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteIntegrationUsers();
    await db.$disconnect();
  });

  it("creates posts and replies, toggles engagement, and reads feed/thread state", async () => {
    currentActorHandle = authorHandle;

    const post = await expectJson<CreatedPostResponse>(
      await createPost(
        jsonRequest("http://localhost/api/posts", {
          content: ` api integration parent ${testRunId} `,
        }),
      ),
      201,
    );

    expect(post).toMatchObject({
      content: `api integration parent ${testRunId}`,
      authorHandle,
    });

    currentActorHandle = viewerHandle;

    const reply = await expectJson<CreatedPostResponse>(
      await createPost(
        jsonRequest("http://localhost/api/posts", {
          content: " api integration reply ",
          parentId: ` ${post.id} `,
        }),
      ),
      201,
    );

    expect(reply).toMatchObject({
      content: "api integration reply",
      authorHandle: viewerHandle,
    });

    await expectJson<ToggleResponse>(
      await postLike(jsonRequest("http://localhost/api/likes", { postId: post.id })),
      200,
    ).then((body) => expect(body).toEqual({ active: true, count: 1 }));

    await expectJson<ToggleResponse>(
      await postRepost(jsonRequest("http://localhost/api/reposts", { postId: post.id })),
      200,
    ).then((body) => expect(body).toEqual({ active: true, count: 1 }));

    const feed = await expectJson<FeedResponse>(
      await getFeed(
        new NextRequest(
          `http://localhost/api/feed?limit=5&q=${encodeURIComponent(`api integration parent ${testRunId}`)}`,
        ),
      ),
      200,
    );

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({
      id: post.id,
      counts: { likes: 1, reposts: 1, replies: 1 },
      viewer: { liked: true, reposted: true },
    });

    const thread = await expectJson<ThreadResponse>(
      await getThread(new NextRequest(`http://localhost/api/posts/${post.id}/thread`), {
        params: Promise.resolve({ postId: post.id }),
      }),
      200,
    );

    expect(thread.post).toMatchObject({
      id: post.id,
      counts: { likes: 1, reposts: 1, replies: 1 },
      viewer: { liked: true, reposted: true },
    });
    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0]).toMatchObject({
      id: reply.id,
      kind: "REPLY",
      content: "api integration reply",
      author: { handle: viewerHandle },
    });
  });
});
