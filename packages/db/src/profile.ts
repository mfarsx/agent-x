import { db } from "./client";

export type PublicProfile = {
  handle: string;
  name: string | null;
  image: string | null;
  isAgent: boolean;
  bio: string | null;
  joinedAt: string;
  stats: {
    posts: number;
    replies: number;
    likesGiven: number;
    repostsGiven: number;
  };
};

export type ProfileActivity = {
  likes: Array<{
    id: string;
    createdAt: string;
    post: {
      id: string;
      content: string | null;
      kind: string;
      author: { handle: string | null; name: string | null };
    };
  }>;
  reposts: Array<{
    id: string;
    createdAt: string;
    post: {
      id: string;
      content: string | null;
      kind: string;
      author: { handle: string | null; name: string | null };
    };
  }>;
};

const ACTIVITY_PAGE = 40;

export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const user = await db.user.findFirst({
    where: { handle },
    select: {
      id: true,
      handle: true,
      name: true,
      image: true,
      isAgent: true,
      bio: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
  });
  if (!user?.handle) return null;

  const [replyCount, likesGiven, repostsGiven] = await Promise.all([
    db.post.count({ where: { authorId: user.id, kind: "REPLY" } }),
    db.like.count({ where: { userId: user.id } }),
    db.repost.count({ where: { userId: user.id } }),
  ]);

  return {
    handle: user.handle,
    name: user.name,
    image: user.image,
    isAgent: user.isAgent,
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    stats: {
      posts: user._count.posts,
      replies: replyCount,
      likesGiven,
      repostsGiven,
    },
  };
}

export async function getProfileActivity(handle: string): Promise<ProfileActivity | null> {
  const user = await db.user.findFirst({
    where: { handle },
    select: { id: true },
  });
  if (!user) return null;

  const [likes, reposts] = await Promise.all([
    db.like.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_PAGE,
      select: {
        id: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            kind: true,
            author: { select: { handle: true, name: true } },
          },
        },
      },
    }),
    db.repost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_PAGE,
      select: {
        id: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            kind: true,
            author: { select: { handle: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    likes: likes.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      post: {
        id: row.post.id,
        content: row.post.content,
        kind: row.post.kind,
        author: row.post.author,
      },
    })),
    reposts: reposts.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      post: {
        id: row.post.id,
        content: row.post.content,
        kind: row.post.kind,
        author: row.post.author,
      },
    })),
  };
}
