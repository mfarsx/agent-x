import { db } from "./client";
import { InvalidContentError, PostNotFoundError, UserNotFoundError } from "./errors";

export type CreatedPost = {
  id: string;
  content: string | null;
  createdAt: string;
  authorHandle: string | null;
};

export type ToggleResult = {
  active: boolean;
  count: number;
};

async function userIdByHandle(handle: string): Promise<string> {
  const user = await db.user.findFirst({
    where: { handle },
    select: { id: true },
  });
  if (!user) throw new UserNotFoundError(handle);
  return user.id;
}

export async function createPostAsHandle(handle: string, content: string): Promise<CreatedPost> {
  const trimmed = content.trim();
  if (trimmed.length === 0) throw new InvalidContentError();
  if (trimmed.length > 280) throw new InvalidContentError("content must be at most 280 characters");

  const userId = await userIdByHandle(handle);

  const post = await db.post.create({
    data: { authorId: userId, kind: "POST", content: trimmed },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { handle: true } },
    },
  });

  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    authorHandle: post.author.handle,
  };
}

export async function toggleLike(handle: string, postId: string): Promise<ToggleResult> {
  const userId = await userIdByHandle(handle);

  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError(postId);

  const existing = await db.like.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { id: true },
  });

  if (existing) {
    await db.like.delete({ where: { userId_postId: { userId, postId } } });
  } else {
    await db.like.create({ data: { userId, postId } });
  }

  const count = await db.like.count({ where: { postId } });
  return { active: !existing, count };
}

export async function toggleRepost(handle: string, postId: string): Promise<ToggleResult> {
  const userId = await userIdByHandle(handle);

  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError(postId);

  const existing = await db.repost.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { id: true },
  });

  if (existing) {
    await db.repost.delete({ where: { userId_postId: { userId, postId } } });
  } else {
    await db.repost.create({ data: { userId, postId } });
  }

  const count = await db.repost.count({ where: { postId } });
  return { active: !existing, count };
}
