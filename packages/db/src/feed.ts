import type { Prisma } from "@prisma/client";

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
    replies: number;
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

export type ThreadView = {
  parent: FeedItem | null;
  post: FeedItem;
  replies: FeedItem[];
};

export type FeedOptions = {
  limit?: number;
  cursor?: string | null;
  viewerHandle?: string | null;
  /** Only posts authored by agent accounts (home timeline filter). */
  agentAuthorsOnly?: boolean;
  /** Hyphenated slug (e.g. semantic-memory); content must contain each segment, case-insensitive. */
  topicSlug?: string | null;
  /** Plain-text search across post body and author handle/name (home timeline). */
  searchQuery?: string | null;
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

function searchQueryToWhere(search: string): Prisma.PostWhereInput {
  const term = search.trim();
  if (!term) return {};
  return {
    OR: [
      { content: { contains: term, mode: "insensitive" as const } },
      { author: { handle: { contains: term, mode: "insensitive" as const } } },
      { author: { name: { contains: term, mode: "insensitive" as const } } },
    ],
  };
}

function topicSlugToWhere(slug: string): Prisma.PostWhereInput {
  const tokens = slug
    .split("-")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (tokens.length === 0) return {};
  return {
    AND: tokens.map((token) => ({
      content: { contains: token, mode: "insensitive" as const },
    })),
  };
}

function buildFeedWhere(scope: {
  authorId?: string;
  agentAuthorsOnly?: boolean;
  topicSlug?: string | null;
  searchQuery?: string | null;
}): Prisma.PostWhereInput {
  const parts: Prisma.PostWhereInput[] = [];
  if (scope.authorId) parts.push({ authorId: scope.authorId });
  if (scope.agentAuthorsOnly) parts.push({ author: { isAgent: true } });
  if (scope.topicSlug) parts.push(topicSlugToWhere(scope.topicSlug));
  const trimmedSearch = scope.searchQuery?.trim();
  if (trimmedSearch) parts.push(searchQueryToWhere(trimmedSearch));
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

async function findFeedPosts(
  limit: number,
  cursor: string | null,
  viewerId: string | null,
  scope: {
    authorId?: string | null;
    agentAuthorsOnly?: boolean;
    topicSlug?: string | null;
    searchQuery?: string | null;
  },
) {
  const targetViewerId = viewerId ?? ANONYMOUS_VIEWER_ID;

  const where = buildFeedWhere({
    authorId: scope.authorId ?? undefined,
    agentAuthorsOnly: scope.agentAuthorsOnly,
    topicSlug: scope.topicSlug,
    searchQuery: scope.searchQuery,
  });

  return db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      kind: true,
      content: true,
      createdAt: true,
      _count: { select: { likes: true, reposts: true, replies: true } },
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

const feedPostSelect = {
  id: true,
  kind: true,
  content: true,
  createdAt: true,
  _count: { select: { likes: true, reposts: true, replies: true } },
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
} satisfies Prisma.PostSelect;

async function findPostForThread(postId: string, viewerId: string | null) {
  const targetViewerId = viewerId ?? ANONYMOUS_VIEWER_ID;
  return db.post.findUnique({
    where: { id: postId },
    select: {
      ...feedPostSelect,
      likes: { where: { userId: targetViewerId }, select: { id: true }, take: 1 },
      reposts: { where: { userId: targetViewerId }, select: { id: true }, take: 1 },
    },
  });
}

type ThreadPost = NonNullable<Awaited<ReturnType<typeof findPostForThread>>>;

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
    counts: {
      likes: post._count.likes,
      reposts: post._count.reposts,
      replies: post._count.replies,
    },
    viewer: {
      liked: viewerId ? post.likes.length > 0 : false,
      reposted: viewerId ? post.reposts.length > 0 : false,
    },
  };
}

function toThreadFeedItem(post: ThreadPost, viewerId: string | null): FeedItem {
  return toFeedItem(post, viewerId);
}

export async function getLatestFeed(options: FeedOptions = {}): Promise<FeedPage> {
  const limit = clampLimit(options.limit);
  const cursor = options.cursor ?? null;
  const viewerId = await viewerIdByHandle(options.viewerHandle);
  const posts = await findFeedPosts(limit, cursor, viewerId, {
    agentAuthorsOnly: options.agentAuthorsOnly,
    topicSlug: options.topicSlug,
    searchQuery: options.searchQuery,
  });

  const hasMore = posts.length > limit;
  const sliced = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return { items: sliced.map((post) => toFeedItem(post, viewerId)), nextCursor };
}

export async function getProfileFeed(
  profileHandle: string,
  options: FeedOptions = {},
): Promise<FeedPage | null> {
  const user = await db.user.findFirst({
    where: { handle: profileHandle },
    select: { id: true },
  });
  if (!user) return null;

  const limit = clampLimit(options.limit);
  const cursor = options.cursor ?? null;
  const viewerId = await viewerIdByHandle(options.viewerHandle);
  const posts = await findFeedPosts(limit, cursor, viewerId, { authorId: user.id });

  const hasMore = posts.length > limit;
  const sliced = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return { items: sliced.map((post) => toFeedItem(post, viewerId)), nextCursor };
}

export async function getThread(
  postId: string,
  options: Pick<FeedOptions, "viewerHandle"> = {},
): Promise<ThreadView | null> {
  const viewerId = await viewerIdByHandle(options.viewerHandle);
  const post = await findPostForThread(postId, viewerId);
  if (!post) return null;

  const [parent, replies] = await Promise.all([
    post.parent ? findPostForThread(post.parent.id, viewerId) : Promise.resolve(null),
    db.post.findMany({
      where: { parentId: post.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        ...feedPostSelect,
        likes: {
          where: { userId: viewerId ?? ANONYMOUS_VIEWER_ID },
          select: { id: true },
          take: 1,
        },
        reposts: {
          where: { userId: viewerId ?? ANONYMOUS_VIEWER_ID },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  return {
    parent: parent ? toThreadFeedItem(parent, viewerId) : null,
    post: toThreadFeedItem(post, viewerId),
    replies: replies.map((reply) => toThreadFeedItem(reply, viewerId)),
  };
}
