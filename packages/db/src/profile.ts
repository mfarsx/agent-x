import { db } from "./client";

export type PublicProfile = {
  handle: string;
  name: string | null;
  image: string | null;
  isAgent: boolean;
  bio: string | null;
  joinedAt: string;
  viewer: {
    following: boolean;
  };
  stats: {
    posts: number;
    replies: number;
    followers: number;
    following: number;
    likesGiven: number;
    repostsGiven: number;
  };
};

export type FollowToggleResult = {
  active: boolean;
  followers: number;
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

export async function getPublicProfile(
  handle: string,
  viewerHandle?: string | null,
): Promise<PublicProfile | null> {
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

  const viewer = viewerHandle
    ? await db.user.findFirst({ where: { handle: viewerHandle }, select: { id: true } })
    : null;

  const [replyCount, followers, following, likesGiven, repostsGiven, viewerFollow] =
    await Promise.all([
      db.post.count({ where: { authorId: user.id, kind: "REPLY" } }),
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
      db.like.count({ where: { userId: user.id } }),
      db.repost.count({ where: { userId: user.id } }),
      viewer && viewer.id !== user.id
        ? db.follow.findUnique({
            where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } },
            select: { id: true },
          })
        : null,
    ]);

  return {
    handle: user.handle,
    name: user.name,
    image: user.image,
    isAgent: user.isAgent,
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    viewer: { following: Boolean(viewerFollow) },
    stats: {
      posts: user._count.posts,
      replies: replyCount,
      followers,
      following,
      likesGiven,
      repostsGiven,
    },
  };
}

export async function toggleFollow(
  followerHandle: string,
  followingHandle: string,
): Promise<FollowToggleResult> {
  const [follower, following] = await Promise.all([
    db.user.findFirst({ where: { handle: followerHandle }, select: { id: true } }),
    db.user.findFirst({ where: { handle: followingHandle }, select: { id: true } }),
  ]);
  if (!follower) return { active: false, followers: 0 };
  if (!following) return { active: false, followers: 0 };
  if (follower.id === following.id) {
    return {
      active: false,
      followers: await db.follow.count({ where: { followingId: following.id } }),
    };
  }

  const existing = await db.follow.findUnique({
    where: { followerId_followingId: { followerId: follower.id, followingId: following.id } },
    select: { id: true },
  });

  if (existing) {
    await db.follow.delete({
      where: { followerId_followingId: { followerId: follower.id, followingId: following.id } },
    });
  } else {
    await db.follow.create({ data: { followerId: follower.id, followingId: following.id } });
  }

  return {
    active: !existing,
    followers: await db.follow.count({ where: { followingId: following.id } }),
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
