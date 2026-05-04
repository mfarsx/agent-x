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

type ExistingPostRelation = { id: string } | null;

type TogglePostRelationOptions = {
  handle: string;
  postId: string;
  findExisting: (userId: string, postId: string) => Promise<ExistingPostRelation>;
  create: (userId: string, postId: string) => Promise<unknown>;
  remove: (userId: string, postId: string) => Promise<unknown>;
  count: (postId: string) => Promise<number>;
};

async function userIdByHandle(handle: string): Promise<string> {
  const user = await db.user.findFirst({
    where: { handle },
    select: { id: true },
  });
  if (!user) throw new UserNotFoundError(handle);
  return user.id;
}

async function ensurePostExists(postId: string): Promise<void> {
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError(postId);
}

function validatePostContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) throw new InvalidContentError();
  if (trimmed.length > 280) throw new InvalidContentError("content must be at most 280 characters");
  return trimmed;
}

function validatePostId(postId: string): string {
  const trimmed = postId.trim();
  if (trimmed.length === 0) throw new PostNotFoundError(postId);
  return trimmed;
}

async function togglePostRelation(options: TogglePostRelationOptions): Promise<ToggleResult> {
  const userId = await userIdByHandle(options.handle);
  await ensurePostExists(options.postId);

  const existing = await options.findExisting(userId, options.postId);
  if (existing) {
    await options.remove(userId, options.postId);
  } else {
    await options.create(userId, options.postId);
  }

  return { active: !existing, count: await options.count(options.postId) };
}

export async function createPostAsHandle(handle: string, content: string): Promise<CreatedPost> {
  const trimmed = validatePostContent(content);

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

export async function createReplyAsHandle(
  handle: string,
  parentPostId: string,
  content: string,
): Promise<CreatedPost> {
  const trimmed = validatePostContent(content);
  const parentId = validatePostId(parentPostId);

  const userId = await userIdByHandle(handle);
  await ensurePostExists(parentId);

  const post = await db.post.create({
    data: { authorId: userId, kind: "REPLY", parentId, content: trimmed },
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
  return togglePostRelation({
    handle,
    postId,
    findExisting: (userId, targetPostId) =>
      db.like.findUnique({
        where: { userId_postId: { userId, postId: targetPostId } },
        select: { id: true },
      }),
    create: (userId, targetPostId) => db.like.create({ data: { userId, postId: targetPostId } }),
    remove: (userId, targetPostId) =>
      db.like.delete({ where: { userId_postId: { userId, postId: targetPostId } } }),
    count: (targetPostId) => db.like.count({ where: { postId: targetPostId } }),
  });
}

export async function toggleRepost(handle: string, postId: string): Promise<ToggleResult> {
  return togglePostRelation({
    handle,
    postId,
    findExisting: (userId, targetPostId) =>
      db.repost.findUnique({
        where: { userId_postId: { userId, postId: targetPostId } },
        select: { id: true },
      }),
    create: (userId, targetPostId) => db.repost.create({ data: { userId, postId: targetPostId } }),
    remove: (userId, targetPostId) =>
      db.repost.delete({ where: { userId_postId: { userId, postId: targetPostId } } }),
    count: (targetPostId) => db.repost.count({ where: { postId: targetPostId } }),
  });
}
