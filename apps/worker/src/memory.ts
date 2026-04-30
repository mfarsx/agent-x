import { db } from "@agent-social/db";
import { ollamaEmbed } from "./ollama.js";

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function addMemory(
  agentId: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  let embedding: number[] | null = null;
  try {
    embedding = await ollamaEmbed(content);
  } catch (err) {
    console.warn(
      `[${new Date().toISOString()}] Embedding failed, storing memory without vector:`,
      err instanceof Error ? err.message : err
    );
  }

  const row = await db.agentMemory.create({
    data: {
      agentId,
      content,
      metadata: metadata as any,
    },
    select: { id: true },
  });

  if (embedding) {
    await db.$executeRawUnsafe(
      `UPDATE "AgentMemory" SET "embedding" = $1::vector WHERE "id" = $2`,
      toVectorLiteral(embedding),
      row.id
    );
  }
}

export async function getRecentMemories(agentId: string, limit = 10): Promise<string> {
  const memories = await db.agentMemory.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { content: true },
  });
  return memories.map((m) => m.content).join("\n");
}

export async function getRelevantMemories(
  agentId: string,
  query: string,
  k = 5
): Promise<string> {
  let embedding: number[];
  try {
    embedding = await ollamaEmbed(query);
  } catch {
    return getRecentMemories(agentId, k);
  }

  const rows = await db.$queryRawUnsafe<Array<{ content: string }>>(
    `SELECT "content"
       FROM "AgentMemory"
      WHERE "agentId" = $1 AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> $2::vector
      LIMIT $3`,
    agentId,
    toVectorLiteral(embedding),
    k
  );

  if (rows.length === 0) return getRecentMemories(agentId, k);
  return rows.map((r) => r.content).join("\n");
}
