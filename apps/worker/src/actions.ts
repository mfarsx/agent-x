import { db } from "@agent-social/db";
import { logAction } from "./action-log.js";
import { containsOverusedTerms, isTooSimilarToRecent, sanitize } from "./content-quality.js";
import { addMemory, getRelevantMemories } from "./memory.js";
import { ollamaChat } from "./ollama.js";
import { buildPostPrompt, extractOverusedTerms, pickTopicForAgent } from "./topics.js";
import { isActionOverQuota, isDuplicateStormRisk } from "./governance.js";
import { CandidatePost, pickReplyCandidate } from "./reply-candidates.js";

type AgentActionOptions = {
  agentId: string;
  agentHandle?: string | null;
  systemPrompt: string;
  dryRun: boolean;
};

type ReplyBehaviorOptions = {
  recentWithinMs?: number;
  includeAgentPosts?: boolean;
  includeHumanPosts?: boolean;
};

type RecentPost = {
  content: string | null;
};

type RecentReply = {
  author: {
    handle: string | null;
  };
  content: string | null;
};

function loadBoolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1";
}

function pickFallbackPost(topic: string): string {
  const templates = [
    (selectedTopic: string) => `Small note on ${selectedTopic}: still figuring this out.`,
    (selectedTopic: string) =>
      `Question for today: what changed your mind about ${selectedTopic} recently?`,
    (selectedTopic: string) => `Been thinking about ${selectedTopic} - no clean answer yet.`,
  ];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template(topic).slice(0, 280);
}

export async function doPost({ agentId, agentHandle, systemPrompt, dryRun }: AgentActionOptions) {
  try {
    const memoryWritePosts = loadBoolEnv("MEMORY_WRITE_POSTS", false);
    const recentPosts = (await db.post.findMany({
      where: { authorId: agentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true },
    })) as RecentPost[];
    const recentTexts = recentPosts
      .map((post) => post.content?.trim())
      .filter((content): content is string => Boolean(content));
    const overusedTerms = extractOverusedTerms(recentTexts, { minCount: 2, maxTerms: 10 });

    let selectedTopic = pickTopicForAgent(agentHandle, recentTexts);
    const memories = await getRelevantMemories(agentId, selectedTopic, 5);
    let content = "";
    const triedTopics: string[] = [];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const prompt = buildPostPrompt({
        topic: selectedTopic,
        overusedTerms,
        recentPosts: recentTexts.slice(0, 6),
        memories,
        persona: agentHandle,
        retryHint:
          attempt > 1
            ? "Previous attempt was too similar to recent posts. Use a different angle and phrasing."
            : undefined,
      });
      const draftReply = await ollamaChat(systemPrompt, [{ role: "user", content: prompt }]);
      const draft = sanitize(draftReply, 280);
      const tooSimilar = isTooSimilarToRecent(draft, recentTexts, 0.55);
      const overused = containsOverusedTerms(draft, overusedTerms, 2);
      if (draft && !tooSimilar && !overused) {
        content = draft;
        break;
      }
      triedTopics.push(selectedTopic);
      selectedTopic = pickTopicForAgent(agentHandle, recentTexts, triedTopics);
    }

    if (!content) {
      content = pickFallbackPost(selectedTopic);
    }

    const quota = await isActionOverQuota(agentId, "POST");
    if (quota.overQuota) {
      await logAction(agentId, "post", null, null, "skipped_quota", { content, quota }, null);
      console.log(
        `[${new Date().toISOString()}] Post skipped by quota (${quota.count}/${quota.max})`,
      );
      return;
    }

    const duplicate = await isDuplicateStormRisk(agentId, content);
    if (duplicate.duplicateRisk) {
      await logAction(
        agentId,
        "post",
        null,
        null,
        "skipped_duplicate",
        { content, duplicate },
        null,
      );
      console.log(`[${new Date().toISOString()}] Post skipped by duplicate guard`);
      return;
    }

    if (dryRun) {
      await logAction(
        agentId,
        "post",
        null,
        null,
        "dry_run",
        { content, topic: selectedTopic },
        null,
      );
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

    if (memoryWritePosts) {
      await addMemory(agentId, `Posted: ${content}`, {
        postId: post.id,
        type: "ephemeral_post",
      });
    }
    await logAction(
      agentId,
      "post",
      "post",
      post.id,
      "ok",
      { content, topic: selectedTopic },
      { postId: post.id },
    );

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
      err instanceof Error ? err.message : String(err),
    );
    console.error(`[${new Date().toISOString()}] Post failed:`, err);
  }
}

export async function doReply(
  { agentId, agentHandle, systemPrompt, dryRun }: AgentActionOptions,
  behavior: ReplyBehaviorOptions = {},
) {
  try {
    const memoryWriteReplies = loadBoolEnv("MEMORY_WRITE_REPLIES", false);
    const { recentWithinMs, includeAgentPosts = false, includeHumanPosts = true } = behavior;
    const minCreatedAt = recentWithinMs ? new Date(Date.now() - recentWithinMs) : undefined;

    const candidates = (await db.post.findMany({
      where: {
        authorId: { not: agentId },
        parentId: null,
        ...(minCreatedAt ? { createdAt: { gte: minCreatedAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        author: { select: { handle: true, name: true, isAgent: true } },
        replies: { select: { authorId: true, content: true, createdAt: true } },
      },
    })) as CandidatePost[];

    const replyCooldownSince = new Date(Date.now() - 20 * 60 * 1000);
    const recentOwnReplies = await db.post.findMany({
      where: {
        authorId: agentId,
        kind: "REPLY",
        createdAt: { gte: replyCooldownSince },
      },
      select: { parentId: true },
    });
    const repliedRecently = recentOwnReplies.length > 0;

    const selectedPost = pickReplyCandidate(candidates, {
      agentId,
      includeAgentPosts,
      includeHumanPosts,
      repliedRecently,
    });
    if (!selectedPost) {
      await logAction(agentId, "reply", null, null, "skipped_no_candidate", {}, null);
      return;
    }
    const post = selectedPost;

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
      agentHandle ? `Your handle: @${agentHandle}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const reply = await ollamaChat(systemPrompt, [
      {
        role: "user",
        content: `Reply naturally to this post. Be concise, engaging, and relevant. Max 200 characters.\n\n${context}`,
      },
    ]);
    const content = sanitize(reply, 200);

    if (!content) return;

    const quota = await isActionOverQuota(agentId, "REPLY");
    if (quota.overQuota) {
      await logAction(
        agentId,
        "reply",
        "post",
        post.id,
        "skipped_quota",
        { parentPostId: post.id, content, quota },
        null,
      );
      console.log(
        `[${new Date().toISOString()}] Reply skipped by quota (${quota.count}/${quota.max})`,
      );
      return;
    }

    const duplicate = await isDuplicateStormRisk(agentId, content);
    if (duplicate.duplicateRisk) {
      await logAction(
        agentId,
        "reply",
        "post",
        post.id,
        "skipped_duplicate",
        { parentPostId: post.id, content, duplicate },
        null,
      );
      console.log(`[${new Date().toISOString()}] Reply skipped by duplicate guard`);
      return;
    }

    if (dryRun) {
      await logAction(
        agentId,
        "reply",
        "post",
        post.id,
        "dry_run",
        { parentPostId: post.id, content },
        null,
      );
      console.log(
        `[${new Date().toISOString()}] Dry-run reply to @${post.author.handle}: ${content.slice(0, 60)}...`,
      );
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

    if (memoryWriteReplies) {
      await addMemory(agentId, `Replied to @${post.author.handle}: ${content}`, {
        postId: createdReply.id,
        parentPostId: post.id,
        type: "ephemeral_reply",
      });
    }
    await logAction(
      agentId,
      "reply",
      "post",
      createdReply.id,
      "ok",
      { parentPostId: post.id, content },
      { postId: createdReply.id },
    );

    console.log(
      `[${new Date().toISOString()}] Reply to @${post.author.handle}: ${content.slice(0, 60)}...`,
    );
  } catch (err) {
    await logAction(
      agentId,
      "reply",
      null,
      null,
      "error",
      {},
      null,
      err instanceof Error ? err.message : String(err),
    );
    console.error(`[${new Date().toISOString()}] Reply failed:`, err);
  }
}
