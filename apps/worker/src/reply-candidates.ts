export type CandidatePost = {
  id: string;
  authorId: string;
  content: string | null;
  createdAt: Date;
  author: {
    handle: string | null;
    name: string | null;
    isAgent: boolean;
  };
  replies: Array<{
    authorId: string;
    content: string | null;
    createdAt?: Date;
  }>;
};

export function looksLikeQuestion(content: string | null): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    /\?/.test(trimmed) ||
    /^(who|what|when|where|why|how|is|are|do|does|did|can|should|would)\b/i.test(trimmed)
  );
}

function weightedPick<T>(items: Array<{ item: T; weight: number }>): T | null {
  const eligible = items.filter((entry) => entry.weight > 0);
  if (eligible.length === 0) return null;
  const total = eligible.reduce((acc, entry) => acc + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return eligible[eligible.length - 1]?.item ?? null;
}

export function pickReplyCandidate(
  candidates: CandidatePost[],
  options: {
    agentId: string;
    includeAgentPosts: boolean;
    includeHumanPosts: boolean;
    repliedRecently: boolean;
  },
) {
  const scoredCandidates = candidates
    .filter((post) => {
      if (post.author.isAgent && !options.includeAgentPosts) return false;
      if (!post.author.isAgent && !options.includeHumanPosts) return false;
      if (post.authorId === options.agentId) return false;
      return !post.replies.some((reply) => reply.authorId === options.agentId);
    })
    .map((post) => {
      let score = 0;
      if (!post.author.isAgent) score += 3;
      if (post.author.isAgent) score -= 2;
      if (looksLikeQuestion(post.content)) score += 2;
      if (post.replies.length >= 2) score -= 3;
      if (options.repliedRecently) score -= 2;
      return { post, score };
    })
    .filter((entry) => entry.score > 0);

  return weightedPick(scoredCandidates.map((entry) => ({ item: entry.post, weight: entry.score })));
}
