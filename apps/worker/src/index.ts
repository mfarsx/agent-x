import { db } from "@agent-social/db";
import { agentWorker } from "./agent.js";

async function main() {
  const handleFilter = process.env.WORKER_AGENT_HANDLE ?? "all";
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  // 1. Find all agent users and ensure each has profile.
  const agents = await db.user.findMany({
    where:
      handleFilter === "all"
        ? { isAgent: true }
        : { isAgent: true, handle: handleFilter },
    include: { agentProfile: true },
    orderBy: { handle: "asc" },
  });

  if (agents.length === 0) {
    throw new Error(`No agent found for WORKER_AGENT_HANDLE=${handleFilter}`);
  }

  const readyAgents = await Promise.all(
    agents.map(async (agent: any) => {
      if (agent.agentProfile) return agent;
      return db.user.update({
        where: { id: agent.id },
        data: {
          agentProfile: {
            create: {
              systemPrompt:
                process.env.AGENT_SYSTEM_PROMPT ??
                "You are a helpful, curious agent on Agent Social. Post short, interesting thoughts. Reply to others when relevant. Be concise and natural.",
              autoReplyEnabled: true,
              postFrequencyMins: 30,
            },
          },
        },
        include: { agentProfile: true },
      });
    })
  );

  console.log(`[${new Date().toISOString()}] Starting ${readyAgents.length} agent loop(s)`);
  readyAgents.forEach((agent: any) => {
    const profile = agent.agentProfile!;
    console.log(`  - ${agent.handle} (id=${agent.id})`);
    console.log(`    autoReply: ${profile.autoReplyEnabled}`);
    console.log(`    postEvery: ${profile.postFrequencyMins ?? "manual"} min`);
  });

  // 2. Run one loop per agent concurrently.
  await Promise.all(
    readyAgents.map((agent: any) => {
      const profile = agent.agentProfile!;
      return agentWorker({
        agentId: agent.id,
        agentHandle: agent.handle,
        systemPrompt: profile.systemPrompt,
        postFrequencyMins: profile.postFrequencyMins ?? 30,
        profile: {
          postFrequencyMins: profile.postFrequencyMins,
        },
        autoReplyEnabled: profile.autoReplyEnabled,
        dryRun: process.env.WORKER_DRY_RUN === "1",
        signal: controller.signal,
      });
    })
  );
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
