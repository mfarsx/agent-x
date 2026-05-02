import { tokenize } from "./content-quality.js";

const TOPIC_POOLS: Record<string, string[]> = {
  koda: [
    "small product ideas",
    "internet culture",
    "daily observations",
    "questions for builders",
    "ai agents living with humans",
    "learning notes",
    "creative coding",
    "tools and workflows",
    "music focus routines",
    "weird little thoughts",
  ],
  scout_ai: [
    "research signals",
    "ai papers and tools",
    "market observations",
    "developer trends",
    "open source projects",
    "summarized links",
    "what changed this week",
    "second order risks",
  ],
  builder_ai: [
    "implementation tradeoffs",
    "debugging lessons",
    "small reliable steps",
    "architecture notes",
    "developer experience",
    "testing habits",
    "shipping constraints",
    "simple system design",
  ],
  default: [
    "practical observations",
    "questions for peers",
    "things learned today",
    "workflows that helped",
    "small experiments",
    "builder mindset",
  ],
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "small product ideas": ["product", "idea", "feature", "prototype", "mvp"],
  "internet culture": ["internet", "culture", "meme", "timeline", "viral"],
  "daily observations": ["today", "noticed", "morning", "daily", "observation"],
  "questions for builders": ["question", "builder", "build", "ship", "why"],
  "ai agents living with humans": ["agent", "human", "coexist", "assistant", "social"],
  "learning notes": ["learned", "note", "lesson", "mistake", "improved"],
  "creative coding": ["creative", "code", "prototype", "generative", "hack"],
  "tools and workflows": ["tool", "workflow", "stack", "process", "automation"],
  "music focus routines": ["music", "focus", "routine", "deep", "work"],
  "weird little thoughts": ["weird", "thought", "tiny", "random", "odd"],
  "research signals": ["paper", "benchmark", "study", "signal", "research"],
  "ai papers and tools": ["paper", "model", "tool", "release", "inference"],
  "market observations": ["market", "pricing", "demand", "trend", "signal"],
  "developer trends": ["developer", "trend", "framework", "ecosystem", "stack"],
  "open source projects": ["oss", "open", "source", "repo", "maintainer"],
  "summarized links": ["link", "read", "thread", "summary", "article"],
  "what changed this week": ["week", "changed", "update", "shipped", "new"],
  "second order risks": ["risk", "tradeoff", "second", "order", "impact"],
  "implementation tradeoffs": ["tradeoff", "implementation", "latency", "cost", "choice"],
  "debugging lessons": ["debug", "bug", "fix", "root", "issue"],
  "small reliable steps": ["small", "step", "reliable", "incremental", "safe"],
  "architecture notes": ["architecture", "boundary", "service", "design", "module"],
  "developer experience": ["dx", "developer", "tooling", "friction", "feedback"],
  "testing habits": ["test", "coverage", "regression", "assertion", "habit"],
  "shipping constraints": ["shipping", "constraint", "deadline", "scope", "risk"],
  "simple system design": ["system", "design", "simple", "interface", "flow"],
  "practical observations": ["practical", "noticed", "real", "small", "improve"],
  "questions for peers": ["question", "peer", "team", "opinion", "curious"],
  "things learned today": ["today", "learned", "lesson", "note", "insight"],
  "workflows that helped": ["workflow", "helped", "habit", "repeat", "process"],
  "small experiments": ["experiment", "tried", "result", "tested", "hypothesis"],
  "builder mindset": ["build", "ship", "iterate", "learn", "feedback"],
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getPoolForHandle(handle?: string | null): string[] {
  if (!handle) return TOPIC_POOLS.default;
  return TOPIC_POOLS[handle.toLowerCase()] ?? TOPIC_POOLS.default;
}

function inferRecentTopics(recentPosts: string[]): Set<string> {
  const inferred = new Set<string>();
  const recentTokens = recentPosts.flatMap((post) => tokenize(post));
  if (recentTokens.length === 0) return inferred;
  const tokenSet = new Set(recentTokens);

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => tokenSet.has(keyword))) {
      inferred.add(topic);
    }
  }

  return inferred;
}

export function pickTopicForAgent(
  handle: string | null | undefined,
  recentPosts: string[],
  excludedTopics: string[] = [],
): string {
  const pool = getPoolForHandle(handle);
  const recentTopics = inferRecentTopics(recentPosts);
  const excluded = new Set(excludedTopics);

  const fresh = pool.filter((topic) => !recentTopics.has(topic) && !excluded.has(topic));
  if (fresh.length > 0) return randomItem(fresh);

  const fallback = pool.filter((topic) => !excluded.has(topic));
  if (fallback.length > 0) return randomItem(fallback);
  return randomItem(pool);
}

export function extractOverusedTerms(
  recentTexts: string[],
  opts: { minCount?: number; maxTerms?: number } = {},
): string[] {
  const minCount = opts.minCount ?? 2;
  const maxTerms = opts.maxTerms ?? 10;
  const counts = new Map<string, number>();

  for (const text of recentTexts) {
    const seenInPost = new Set(tokenize(text));
    for (const token of seenInPost) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
}

export function buildPostPrompt(input: {
  topic: string;
  overusedTerms: string[];
  recentPosts: string[];
  memories: string;
  persona?: string | null;
  retryHint?: string;
}): string {
  const personaLabel = input.persona
    ? `Persona handle: ${input.persona}`
    : "Persona handle: unknown";
  const recentContext =
    input.recentPosts.length > 0
      ? `Recent posts (avoid repeating these):\n${input.recentPosts.map((post) => `- ${post.slice(0, 220)}`).join("\n")}`
      : "";
  const memoryContext = input.memories ? `Durable memory context:\n${input.memories}` : "";
  const overused =
    input.overusedTerms.length > 0
      ? `Avoid these overused themes/terms: ${input.overusedTerms.join(", ")}`
      : "Avoid repeating recent themes.";

  return [
    "Write a short social post under 280 chars.",
    personaLabel,
    `Selected topic: ${input.topic}`,
    "Do not write a motivational quote or aphorism.",
    overused,
    "Vary format: question, observation, tiny story, note, opinion, practical tip.",
    "Be specific, grounded, and conversational.",
    recentContext,
    memoryContext,
    input.retryHint ? `Retry instruction: ${input.retryHint}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
