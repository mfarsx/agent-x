import { db } from "./client";

export type FeedItem = {
  id: string;
  kind: string;
  content: string | null;
  createdAt: string;
  author: {
    id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
    isAgent: boolean;
  };
  parent: {
    id: string;
    content: string | null;
    author: {
      handle: string | null;
      name: string | null;
      isAgent: boolean;
    };
  } | null;
  quotedPost: {
    id: string;
    content: string | null;
    author: {
      handle: string | null;
      name: string | null;
      isAgent: boolean;
    };
  } | null;
  counts: {
    likes: number;
    reposts: number;
  };
  viewer: {
    liked: boolean;
    reposted: boolean;
  };
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
};

export type FeedOptions = {
  limit?: number;
  cursor?: string | null;
  viewerHandle?: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const ANONYMOUS_VIEWER_ID = "__anonymous_viewer__";

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

async function viewerIdByHandle(handle: string | null | undefined): Promise<string | null> {
  if (!handle) return null;
  const viewer = await db.user.findFirst({
    where: { handle },
    select: { id: true },
  });
  return viewer?.id ?? null;
}

async function findFeedPosts(limit: number, cursor: string | null, viewerId: string | null) {
  const targetViewerId = viewerId ?? ANONYMOUS_VIEWER_ID;

  return db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      kind: true,
      content: true,
      createdAt: true,
      _count: { select: { likes: true, reposts: true } },
      author: { select: { id: true, handle: true, name: true, image: true, isAgent: true } },
      parent: {
        select: {
          id: true,
          content: true,
          author: { select: { handle: true, name: true, isAgent: true } },
        },
      },
      quotedPost: {
        select: {
          id: true,
          content: true,
          author: { select: { handle: true, name: true, isAgent: true } },
        },
      },
      likes: { where: { userId: targetViewerId }, select: { id: true }, take: 1 },
      reposts: { where: { userId: targetViewerId }, select: { id: true }, take: 1 },
    },
  });
}

type FeedPost = Awaited<ReturnType<typeof findFeedPosts>>[number];

function toFeedItem(post: FeedPost, viewerId: string | null): FeedItem {
  return {
    id: post.id,
    kind: post.kind,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: post.author.id,
      handle: post.author.handle,
      name: post.author.name,
      image: post.author.image,
      isAgent: post.author.isAgent,
    },
    parent: post.parent
      ? {
          id: post.parent.id,
          content: post.parent.content,
          author: post.parent.author,
        }
      : null,
    quotedPost: post.quotedPost
      ? {
          id: post.quotedPost.id,
          content: post.quotedPost.content,
          author: post.quotedPost.author,
        }
      : null,
    counts: { likes: post._count.likes, reposts: post._count.reposts },
    viewer: {
      liked: viewerId ? post.likes.length > 0 : false,
      reposted: viewerId ? post.reposts.length > 0 : false,
    },
  };
}

export async function getLatestFeed(options: FeedOptions = {}): Promise<FeedPage> {
  const limit = clampLimit(options.limit);
  const cursor = options.cursor ?? null;
  const viewerId = await viewerIdByHandle(options.viewerHandle);
  const posts = await findFeedPosts(limit, cursor, viewerId);

  const hasMore = posts.length > limit;
  const sliced = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return { items: sliced.map((post) => toFeedItem(post, viewerId)), nextCursor };
}
