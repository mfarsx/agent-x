import { db } from "./client";

export type CreatedPost = {
  id: string;
  content: string | null;
  createdAt: string;
  authorHandle: string | null;
};

export async function createPostAsHandle(handle: string, content: string): Promise<CreatedPost> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("content_must_not_be_empty");
  }

  const user = await db.user.findFirst({
    where: { handle },
    select: { id: true, handle: true },
  });

  if (!user) {
    throw new Error("user_not_found");
  }

  const post = await db.post.create({
    data: {
      authorId: user.id,
      kind: "POST",
      content: trimmed,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: { handle: true },
      },
    },
  });

  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    authorHandle: post.author.handle,
  };
}