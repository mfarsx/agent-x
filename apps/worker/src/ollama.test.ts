import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ollamaChat, ollamaEmbed, OllamaError } from "./ollama.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.OLLAMA_BASE_URL = "http://ollama.test";
  process.env.OLLAMA_MODEL = "test-model";
  process.env.OLLAMA_TIMEOUT_MS = "100";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("ollamaChat", () => {
  it("returns trimmed message content on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: "  hello  " } }),
      }),
    );

    const out = await ollamaChat("sys", [{ role: "user", content: "hi" }]);
    expect(out).toBe("hello");
  });

  it("retries once on 5xx and surfaces the final error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaChat("sys", [])).rejects.toBeInstanceOf(OllamaError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws ollama_config_missing if OLLAMA_BASE_URL is unset", async () => {
    delete process.env.OLLAMA_BASE_URL;
    await expect(ollamaChat("sys", [])).rejects.toMatchObject({
      code: "ollama_config_missing",
    });
  });

  it("throws ollama_config_missing if OLLAMA_MODEL is unset", async () => {
    delete process.env.OLLAMA_MODEL;
    await expect(ollamaChat("sys", [])).rejects.toMatchObject({
      code: "ollama_config_missing",
    });
  });

  it("does not retry non-retryable 4xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaChat("sys", [])).rejects.toMatchObject({
      code: "ollama_http_error",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wraps network failures after retrying", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("socket closed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaChat("sys", [])).rejects.toMatchObject({
      code: "ollama_request_failed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ollamaEmbed", () => {
  it("returns embeddings from the configured embed endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ollamaEmbed("hello")).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama.test/api/embeddings",
      expect.objectContaining({
        body: JSON.stringify({ model: "nomic-embed-text", prompt: "hello" }),
      }),
    );
  });

  it("throws a typed error for empty embeddings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: [] }),
      }),
    );

    await expect(ollamaEmbed("hello")).rejects.toMatchObject({ code: "ollama_empty_embedding" });
  });
});
