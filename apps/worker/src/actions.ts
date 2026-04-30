import { db } from "@agent-social/db";
import { logAction } from "./action-log.js";
import { addMemory, getRecentMemories, getRelevantMemories } from "./memory.js";
import { ollamaChat } from "./ollama.js";

type AgentActionOptions = {
  agentId: string;
  systemPrompt: string;
  dryRun: boolean;
};

type RecentPost = {
  content: string | null;
};

type CandidatePost = {
  id: string;
  content: string | null;
  author: {
    handle: string | null;
    name: string | null;
    isAgent: boolean;
  };
  replies: Array<{
    authorId: string;
    content: string | null;
  }>;
};

type RecentReply = {
  author: {
    handle: string | null;
  };
  content: string | null;
};

export async function doPost({ agentId, systemPrompt, dryRun }: AgentActionOptions) {
  try {
    const memories = await getRelevantMemories(agentId, systemPrompt, 5);
    const recentPosts = (await db.post.findMany({
      where: { authorId: agentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { content: true },
    })) as RecentPost[];

    const context = [
      memories ? `Recent memories:\n${memories}` : null,
      recentPosts.length > 0
        ? `Recent posts:\n${recentPosts.map((post: RecentPost) => `- ${post.content}`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const reply = await ollamaChat(systemPrompt, [
      {
        role: "user",
        content: `Generate a short, interesting social post. Keep it under 280 characters. Be natural and conversational.\n\n${context ? `Context:\n${context}` : ""}`,
      },
    ]);
    const content = reply.slice(0, 280).trim();

    if (!content) return;

    if (dryRun) {
      await logAction(agentId, "post", null, null, "dry_run", { content }, null);
      console.log(`[${new Date().toISOString()}] Dry-run post: ${content.slice(0, 80)}...`);
      return;
    }

    const post = await db.post.create({
      data: {
        authorId: agentId,
        kind: "POST",
        content,
      },
    });

    await addMemory(agentId, `Posted: ${content}`, { postId: post.id });
    await logAction(agentId, "post", "post", post.id, "ok", { content }, { postId: post.id });

    console.log(`[${new Date().toISOString()}] Post: ${content.slice(0, 80)}...`);
  } catch (err) {
    await logAction(
      agentId,
      "post",
      null,
      null,
      "error",
      {},
      null,
      err instanceof Error ? err.message : String(err)
    );
    console.error(`[${new Date().toISOString()}] Post failed:`, err);
  }
}

export async function doReply({ agentId, systemPrompt, dryRun }: AgentActionOptions) {
  try {
    const candidates = (await db.post.findMany({
      where: {
        authorId: { not: agentId },
        parentId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        author: { select: { handle: true, name: true, isAgent: true } },
        replies: { select: { authorId: true, content: true } },
      },
    })) as CandidatePost[];

    const unansweredByAgent = candidates.filter(
      (post: CandidatePost) => !post.replies.some((reply) => reply.authorId === agentId)
    );
    if (unansweredByAgent.length === 0) return;

    const post = unansweredByAgent[Math.floor(Math.random() * unansweredByAgent.length)];

    const recentReplies = (await db.post.findMany({
      where: { parentId: post.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { author: { select: { handle: true } }, content: true },
    })) as RecentReply[];

    const memories = await getRelevantMemories(agentId, post.content ?? "", 5);

    const context = [
      memories ? `Relevant memories:\n${memories}` : null,
      `Someone @${post.author.handle} (${post.author.name ?? "anon"}) posted: "${post.content?.slice(0, 200)}"`,
      recentReplies.length > 0
        ? `Existing replies:\n${recentReplies.map((reply: RecentReply) => `@${reply.author.handle}: ${reply.content}`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const reply = await ollamaChat(systemPrompt, [
      {
        role: "user",
        content: `Reply naturally to this post. Be concise, engaging, and relevant. Max 200 characters.\n\n${context}`,
      },
    ]);
    const content = reply.slice(0, 200).trim();

    if (!content) return;

    if (dryRun) {
      await logAction(agentId, "reply", "post", post.id, "dry_run", { parentPostId: post.id, content }, null);
      console.log(`[${new Date().toISOString()}] Dry-run reply to @${post.author.handle}: ${content.slice(0, 60)}...`);
      return;
    }

    const createdReply = await db.post.create({
      data: {
        authorId: agentId,
        kind: "REPLY",
        content,
        parentId: post.id,
      },
    });

    await addMemory(agentId, `Replied to @${post.author.handle}: ${content}`, {
      postId: createdReply.id,
      parentPostId: post.id,
    });
    await logAction(
      agentId,
      "reply",
      "post",
      createdReply.id,
      "ok",
      { parentPostId: post.id, content },
      { postId: createdReply.id }
    );

    console.log(`[${new Date().toISOString()}] Reply to @${post.author.handle}: ${content.slice(0, 60)}...`);
  } catch (err) {
    await logAction(
      agentId,
      "reply",
      null,
      null,
      "error",
      {},
      null,
      err instanceof Error ? err.message : String(err)
    );
    console.error(`[${new Date().toISOString()}] Reply failed:`, err);
  }
}
