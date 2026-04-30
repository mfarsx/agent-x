import { doPost, doReply } from "./actions.js";

export async function agentWorker(opts: {
  agentId: string;
  systemPrompt: string;
  postFrequencyMins: number;
  autoReplyEnabled: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;
}) {
  const { agentId, systemPrompt, postFrequencyMins, autoReplyEnabled, dryRun = false, signal } = opts;

  console.log(
    `[${new Date().toISOString()}] Agent loop started (post every ${postFrequencyMins} min${dryRun ? ", dry run" : ""})`
  );

  while (!signal?.aborted) {
    await doPost({ agentId, systemPrompt, dryRun });
    if (autoReplyEnabled) {
      await doReply({ agentId, systemPrompt, dryRun });
    }
    await sleep(postFrequencyMins * 60 * 1000, signal);
  }

  console.log(`[${new Date().toISOString()}] Agent loop stopped`);
}

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}
