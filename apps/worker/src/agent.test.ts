import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions.js", () => ({
  doPost: vi.fn(),
  doReply: vi.fn(),
}));

import { agentWorker } from "./agent.js";
import { doPost, doReply } from "./actions.js";

const originalEnv = { ...process.env };
const baseOptions = {
  agentId: "agent-1",
  agentHandle: "scout_ai",
  systemPrompt: "be useful",
  postFrequencyMins: 10,
};

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    STARTUP_STAGGER_MIN_MS: "0",
    STARTUP_STAGGER_MAX_MS: "1",
    POST_INTERVAL_STRATEGY: "env",
    POST_INTERVAL_MIN_MINS: "1",
    POST_INTERVAL_MAX_MINS: "1",
    QUICK_REPLY_DELAY_MIN_MS: "5000",
    QUICK_REPLY_DELAY_MAX_MS: "5000",
  };
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("agentWorker", () => {
  it("posts once and stops cleanly when aborted", async () => {
    const controller = new AbortController();
    vi.mocked(doPost).mockImplementation(async () => {
      controller.abort();
    });

    const run = agentWorker({ ...baseOptions, autoReplyEnabled: false, signal: controller.signal });
    await vi.runOnlyPendingTimersAsync();
    await run;

    expect(doPost).toHaveBeenCalledWith({
      agentId: "agent-1",
      agentHandle: "scout_ai",
      systemPrompt: "be useful",
      dryRun: false,
    });
    expect(doReply).not.toHaveBeenCalled();
  });

  it("runs the configured quick reply path before the next wait", async () => {
    process.env.QUICK_REPLY_ENABLED = "1";
    process.env.QUICK_REPLY_PROBABILITY = "1";
    process.env.QUICK_REPLY_INCLUDE_AGENTS = "1";
    process.env.QUICK_REPLY_INCLUDE_HUMANS = "0";
    process.env.QUICK_REPLY_LOOKBACK_MS = "30000";
    const controller = new AbortController();
    vi.mocked(doPost).mockResolvedValue(undefined);
    vi.mocked(doReply).mockImplementation(async () => {
      if (vi.mocked(doReply).mock.calls.length === 2) controller.abort();
    });

    const run = agentWorker({
      ...baseOptions,
      autoReplyEnabled: true,
      dryRun: true,
      signal: controller.signal,
    });
    await vi.runOnlyPendingTimersAsync();
    await flushMicrotasks();
    await vi.runOnlyPendingTimersAsync();
    await run;

    expect(doReply).toHaveBeenCalledTimes(2);
    expect(doReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ agentId: "agent-1", dryRun: true }),
      {
        recentWithinMs: 30000,
        includeAgentPosts: true,
        includeHumanPosts: false,
      },
    );
  });

  it("uses profile intervals and skips quick replies when probability misses", async () => {
    process.env.POST_INTERVAL_STRATEGY = "profile";
    process.env.QUICK_REPLY_PROBABILITY = "0";
    const controller = new AbortController();
    vi.mocked(doPost).mockResolvedValue(undefined);
    vi.mocked(doReply).mockImplementation(async () => {
      controller.abort();
    });

    const run = agentWorker({
      ...baseOptions,
      profile: { postFrequencyMins: 10 },
      autoReplyEnabled: true,
      signal: controller.signal,
    });
    await vi.runOnlyPendingTimersAsync();
    await flushMicrotasks();
    await run;

    expect(doReply).toHaveBeenCalledTimes(1);
  });

  it("honors weighted env intervals and ignores invalid weight pairs", async () => {
    process.env.POST_INTERVAL_STRATEGY = "env";
    process.env.POST_INTERVAL_MIN_MINS = "2";
    process.env.POST_INTERVAL_MAX_MINS = "4";
    process.env.POST_INTERVAL_WEIGHTS = "bad,1:2,2:0,3:4,5:9";
    const controller = new AbortController();
    vi.mocked(doPost).mockImplementation(async () => {
      controller.abort();
    });

    const run = agentWorker({ ...baseOptions, autoReplyEnabled: false, signal: controller.signal });
    await vi.runOnlyPendingTimersAsync();
    await run;

    expect(doPost).toHaveBeenCalledTimes(1);
  });

  it("normalizes startup max delay when it is configured below min delay", async () => {
    process.env.STARTUP_STAGGER_MIN_MS = "1000";
    process.env.STARTUP_STAGGER_MAX_MS = "500";
    const controller = new AbortController();
    vi.mocked(doPost).mockImplementation(async () => {
      controller.abort();
    });

    const run = agentWorker({ ...baseOptions, autoReplyEnabled: false, signal: controller.signal });
    await vi.advanceTimersByTimeAsync(999);
    expect(doPost).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await run;

    expect(doPost).toHaveBeenCalledTimes(1);
  });
});
