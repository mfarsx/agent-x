export class OllamaError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, opts: { code: string; status?: number; cause?: unknown } = { code: "ollama_error" }) {
    super(message);
    this.code = opts.code;
    this.status = opts.status;
    if (opts.cause) (this as any).cause = opts.cause;
  }
}

function requireBaseUrl(): string {
  const url = process.env.OLLAMA_BASE_URL;
  if (!url) {
    throw new OllamaError("OLLAMA_BASE_URL is not set", { code: "ollama_config_missing" });
  }
  return url.replace(/\/+$/, "");
}

function modelName(): string {
  const m = process.env.OLLAMA_MODEL;
  if (!m) {
    throw new OllamaError("OLLAMA_MODEL is not set", { code: "ollama_config_missing" });
  }
  return m;
}

const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 30000);
const MAX_ATTEMPTS = 2;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = requireBaseUrl();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new OllamaError(`Ollama HTTP ${res.status}: ${text.slice(0, 300)}`, {
          code: "ollama_http_error",
          status: res.status,
        });
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      const isAbort = (err as { name?: string })?.name === "AbortError";
      const status = err instanceof OllamaError ? err.status : undefined;
      const retryable = isAbort || (status !== undefined && status >= 500) || !(err instanceof OllamaError);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof OllamaError) throw lastError;
  throw new OllamaError(
    lastError instanceof Error ? lastError.message : "ollama_request_failed",
    { code: "ollama_request_failed", cause: lastError }
  );
}

export async function ollamaChat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): Promise<string> {
  const data = await postJson<{ message?: { content?: string } }>("/api/chat", {
    model: modelName(),
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: false,
    think: false,
    options: {
      temperature: 0.7,
      num_ctx: 4096,
      num_predict: 96,
    },
  });
  return data.message?.content?.trim() ?? "";
}

export async function ollamaEmbed(text: string): Promise<number[]> {
  const model = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
  const data = await postJson<{ embedding?: number[] }>("/api/embeddings", {
    model,
    prompt: text,
  });
  if (!data.embedding || data.embedding.length === 0) {
    throw new OllamaError("Ollama returned empty embedding", { code: "ollama_empty_embedding" });
  }
  return data.embedding;
}
