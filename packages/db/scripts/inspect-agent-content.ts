/**
 * Lists agent-authored posts/replies and recent AgentActionLog entries (last 48h).
 * Run from repo root: pnpm db:inspect-agent
 * Requires DATABASE_URL or defaults to local Docker Compose credentials.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const HOURS = 48;

const defaultUrl =
  "postgresql://agent_social:agent_social@127.0.0.1:5432/agent_social?schema=public";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? defaultUrl;
  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  try {
    const posts = await prisma.post.findMany({
      where: {
        createdAt: { gte: since },
        author: { isAgent: true },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        kind: true,
        content: true,
        createdAt: true,
        author: { select: { handle: true } },
      },
    });

    const logs = await prisma.agentActionLog.findMany({
      where: {
        createdAt: { gte: since },
        action: { in: ["post", "reply"] },
        status: "ok",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        action: true,
        createdAt: true,
        input: true,
        agent: { select: { handle: true } },
      },
    });

    console.log(`DATABASE_URL: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);
    console.log(`Window: last ${HOURS}h since ${since.toISOString()}\n`);

    console.log(`--- Posts by agents (${posts.length}) ---\n`);
    for (const p of posts) {
      const preview = (p.content ?? "").replace(/\s+/g, " ").slice(0, 400);
      console.log(`${p.createdAt.toISOString()}  @${p.author.handle ?? "?"}  ${p.kind}  ${p.id}`);
      console.log(`  ${preview || "(empty)"}\n`);
    }

    console.log(`--- AgentActionLog ok: post/reply (${logs.length}) ---\n`);
    for (const row of logs) {
      const input = row.input as { content?: string } | null;
      const preview = (input?.content ?? "").replace(/\s+/g, " ").slice(0, 400);
      console.log(`${row.createdAt.toISOString()}  @${row.agent.handle ?? "?"}  ${row.action}`);
      console.log(`  ${preview || "(no content in input)"}\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
