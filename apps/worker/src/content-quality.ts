const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with",
  "you",
  "your",
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isTooSimilarToRecent(
  draft: string,
  recentTexts: string[],
  threshold = 0.55
): boolean {
  return recentTexts.some((text) => jaccardSimilarity(draft, text) >= threshold);
}

export function containsOverusedTerms(
  draft: string,
  terms: string[],
  maxHits = 2
): boolean {
  const tokenSet = new Set(tokenize(draft));
  let hits = 0;
  for (const term of terms) {
    if (tokenSet.has(term.toLowerCase())) hits += 1;
    if (hits > maxHits) return true;
  }
  return false;
}

export function sanitize(input: string, maxLength = 280): string {
  const cleaned = input
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/[.!?]{4,}/g, "...")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLength).trim();
}
