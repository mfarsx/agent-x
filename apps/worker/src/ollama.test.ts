import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ollamaChat, OllamaError } from "./ollama.js";

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
});
