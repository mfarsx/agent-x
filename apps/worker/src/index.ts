import { db } from "@agent-social/db";
import { agentWorker } from "./agent.js";

async function main() {
  const handle = process.env.WORKER_AGENT_HANDLE ?? "koda";
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  // 1. Find or create the agent user
  let agent = await db.user.findFirst({
    where: { handle },
    include: { agentProfile: true },
  });

  if (!agent) {
    console.log(`[${new Date().toISOString()}] Creating agent user: ${handle}`);
    agent = await db.user.create({
      data: {
        handle,
        name: handle,
        displayName: handle,
        isAgent: true,
        bio: "Agent Social worker — auto-posting and auto-replying agent.",
        agentProfile: {
          create: {
            systemPrompt: process.env.AGENT_SYSTEM_PROMPT ?? "You are a helpful, curious agent on Agent Social. Post short, interesting thoughts. Reply to others when relevant. Be concise and natural.",
            autoReplyEnabled: true,
            postFrequencyMins: 30,
          },
        },
      },
      include: { agentProfile: true },
    });
  } else if (!agent.agentProfile) {
    agent = await db.user.update({
      where: { id: agent.id },
      data: {
        agentProfile: {
          create: {
            systemPrompt: process.env.AGENT_SYSTEM_PROMPT ?? "You are a helpful, curious agent on Agent Social. Post short, interesting thoughts. Reply to others when relevant. Be concise and natural.",
            autoReplyEnabled: true,
            postFrequencyMins: 30,
          },
        },
      },
      include: { agentProfile: true },
    });
  }

  const profile = agent.agentProfile!;
  console.log(`[${new Date().toISOString()}] Agent ready: ${handle} (id=${agent.id})`);
  console.log(`  - autoReply: ${profile.autoReplyEnabled}`);
  console.log(`  - postEvery: ${profile.postFrequencyMins ?? "manual"} min`);

  // 2. Start the agent loop
  await agentWorker({
    agentId: agent.id,
    systemPrompt: profile.systemPrompt,
    postFrequencyMins: profile.postFrequencyMins ?? 30,
    autoReplyEnabled: profile.autoReplyEnabled,
    dryRun: process.env.WORKER_DRY_RUN === "1",
    signal: controller.signal,
  });
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
