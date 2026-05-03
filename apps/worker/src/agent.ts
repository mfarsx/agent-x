import { doPost, doReply } from "./actions.js";

export async function agentWorker(opts: {
  agentId: string;
  agentHandle?: string | null;
  systemPrompt: string;
  postFrequencyMins: number;
  profile?: {
    postFrequencyMins?: number | null;
  };
  autoReplyEnabled: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;
}) {
  const {
    agentId,
    agentHandle,
    systemPrompt,
    postFrequencyMins,
    profile,
    autoReplyEnabled,
    dryRun = false,
    signal,
  } = opts;
  const intervalCfg = loadIntervalConfig(postFrequencyMins, profile?.postFrequencyMins ?? null);
  const quickReplyCfg = loadQuickReplyConfig();
  const startupCfg = loadStartupConfig();

  console.log(
    `[${new Date().toISOString()}] Agent loop started (${intervalCfg.strategy} interval${dryRun ? ", dry run" : ""})`,
  );

  // Stagger startup so multiple agents don't post at once.
  const startupDelayMs = randomBetween(startupCfg.minDelayMs, startupCfg.maxDelayMs + 1);
  console.log(
    `[${new Date().toISOString()}] Initial startup delay ${Math.round(startupDelayMs / 1000)}s`,
  );
  await sleep(startupDelayMs, signal);

  while (!signal?.aborted) {
    await doPost({ agentId, agentHandle, systemPrompt, dryRun });
    if (autoReplyEnabled) {
      await doReply({ agentId, agentHandle, systemPrompt, dryRun });
      if (quickReplyCfg.enabled && Math.random() < quickReplyCfg.probability) {
        const delay = randomBetween(quickReplyCfg.delayMinMs, quickReplyCfg.delayMaxMs);
        console.log(
          `[${new Date().toISOString()}] Quick-reply scheduled in ${Math.round(delay / 1000)}s`,
        );
        await sleep(delay, signal);
        if (!signal?.aborted) {
          await doReply(
            { agentId, agentHandle, systemPrompt, dryRun },
            {
              recentWithinMs: quickReplyCfg.lookbackMs,
              includeAgentPosts: quickReplyCfg.includeAgentPosts,
              includeHumanPosts: quickReplyCfg.includeHumanPosts,
            },
          );
        }
      }
    }
    const waitMs = pickIntervalMs(intervalCfg);
    console.log(`[${new Date().toISOString()}] Next post wait ${Math.round(waitMs / 60000)}m`);
    await sleep(waitMs, signal);
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
      { once: true },
    );
  });
}

function loadIntervalConfig(
  defaultPostFrequencyMins: number,
  profilePostFrequencyMins: number | null,
): {
  strategy: "profile" | "env";
  profilePostFrequencyMins: number | null;
  minMins: number;
  maxMins: number;
  weights: Map<number, number>;
} {
  const strategy = (process.env.POST_INTERVAL_STRATEGY ?? "profile") === "env" ? "env" : "profile";
  const minMins = clampInt(process.env.POST_INTERVAL_MIN_MINS, 5, 1, 720);
  const maxMins = clampInt(process.env.POST_INTERVAL_MAX_MINS, 120, minMins, 720);
  const weights = parseWeights(process.env.POST_INTERVAL_WEIGHTS, minMins, maxMins);

  if (weights.size === 0) {
    for (let minute = minMins; minute <= maxMins; minute++) {
      const defaultWeight = minute <= 30 ? 1 : 3;
      weights.set(minute, defaultWeight);
    }
  }
  if (weights.size === 0) {
    weights.set(Math.max(5, defaultPostFrequencyMins), 1);
  }
  return {
    strategy,
    profilePostFrequencyMins:
      profilePostFrequencyMins && profilePostFrequencyMins > 0 ? profilePostFrequencyMins : null,
    minMins,
    maxMins,
    weights,
  };
}

function pickIntervalMs(cfg: {
  strategy: "profile" | "env";
  profilePostFrequencyMins: number | null;
  minMins: number;
  maxMins: number;
  weights: Map<number, number>;
}): number {
  if (cfg.strategy === "profile" && cfg.profilePostFrequencyMins) {
    const base = cfg.profilePostFrequencyMins;
    const min = Math.max(1, Math.round(base * 0.7));
    const max = Math.max(min, Math.round(base * 1.5));
    return randomBetween(min, max + 1) * 60 * 1000;
  }

  let total = 0;
  for (const weight of cfg.weights.values()) total += weight;
  let roll = Math.random() * total;
  for (let minute = cfg.minMins; minute <= cfg.maxMins; minute++) {
    const weight = cfg.weights.get(minute) ?? 0;
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) return minute * 60 * 1000;
  }
  return cfg.maxMins * 60 * 1000;
}

function parseWeights(
  raw: string | undefined,
  minMins: number,
  maxMins: number,
): Map<number, number> {
  const weights = new Map<number, number>();
  if (!raw?.trim()) return weights;

  for (const pair of raw.split(",")) {
    const [minuteRaw, weightRaw] = pair.split(":").map((x) => x?.trim());
    const minute = Number(minuteRaw);
    const weight = Number(weightRaw);
    if (!Number.isFinite(minute) || !Number.isFinite(weight)) continue;
    if (minute < minMins || minute > maxMins || weight <= 0) continue;
    weights.set(minute, weight);
  }
  return weights;
}

function loadQuickReplyConfig() {
  return {
    enabled: (process.env.QUICK_REPLY_ENABLED ?? "1") === "1",
    probability: clampNumber(process.env.QUICK_REPLY_PROBABILITY, 0.15, 0, 1),
    delayMinMs: clampInt(process.env.QUICK_REPLY_DELAY_MIN_MS, 90_000, 5_000, 3_600_000),
    delayMaxMs: clampInt(process.env.QUICK_REPLY_DELAY_MAX_MS, 180_000, 5_000, 3_600_000),
    lookbackMs: clampInt(process.env.QUICK_REPLY_LOOKBACK_MS, 600_000, 30_000, 86_400_000),
    includeAgentPosts: (process.env.QUICK_REPLY_INCLUDE_AGENTS ?? "0") === "1",
    includeHumanPosts: (process.env.QUICK_REPLY_INCLUDE_HUMANS ?? "1") === "1",
  };
}

function loadStartupConfig() {
  const minDelayMs = clampInt(process.env.STARTUP_STAGGER_MIN_MS, 120_000, 0, 3_600_000);
  const configuredMaxDelayMs = clampInt(
    process.env.STARTUP_STAGGER_MAX_MS,
    600_000,
    1_000,
    3_600_000,
  );

  return {
    minDelayMs,
    maxDelayMs: Math.max(minDelayMs, configuredMaxDelayMs),
  };
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min));
}
