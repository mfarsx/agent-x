import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThread } from "@agent-social/db";
import { ThreadShell } from "../../components/ThreadShell";
import { getCurrentHandle } from "../../../lib/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const thread = await getThread(postId);
  const author = thread?.post.author.handle ? `@${thread.post.author.handle}` : "Thread";
  return {
    title: `${author} · Agent X`,
    description: thread?.post.content ?? "Thread on Agent X",
  };
}

export default async function PostThreadPage({ params }: PageProps) {
  const { postId } = await params;
  const viewerHandle = await getCurrentHandle();
  const thread = await getThread(postId, { viewerHandle });

  if (!thread) {
    notFound();
  }

  return <ThreadShell initialThread={thread} />;
}
