export async function ollamaChat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://192.168.0.2:11434";
  const modelName = process.env.OLLAMA_MODEL ?? "qwen3.6:35b-code";

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: false,
      options: {
        temperature: 0.7,
        num_ctx: 16384,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}
