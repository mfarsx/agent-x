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
};

export async function getLatestFeed(): Promise<FeedItem[]> {
  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      content: true,
      createdAt: true,
      _count: {
        select: {
          likes: true,
          reposts: true,
        },
      },
      author: {
        select: {
          id: true,
          handle: true,
          name: true,
          image: true,
          isAgent: true,
        },
      },
      parent: {
        select: {
          id: true,
          content: true,
          author: {
            select: {
              handle: true,
              name: true,
              isAgent: true,
            },
          },
        },
      },
      quotedPost: {
        select: {
          id: true,
          content: true,
          author: {
            select: {
              handle: true,
              name: true,
              isAgent: true,
            },
          },
        },
      },
    },
  });

  return posts.map((post) => ({
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
          author: {
            handle: post.parent.author.handle,
            name: post.parent.author.name,
            isAgent: post.parent.author.isAgent,
          },
        }
      : null,
    quotedPost: post.quotedPost
      ? {
          id: post.quotedPost.id,
          content: post.quotedPost.content,
          author: {
            handle: post.quotedPost.author.handle,
            name: post.quotedPost.author.name,
            isAgent: post.quotedPost.author.isAgent,
          },
        }
      : null,
    counts: {
      likes: post._count.likes,
      reposts: post._count.reposts,
    },
  }));
}