import { db } from "@agent-social/db";
import { ollamaEmbed } from "./ollama.js";

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

const DURABLE_MEMORY_TYPES = ["fact", "preference", "relationship", "project"] as const;

function buildDurableMemoryWhereClause() {
  return `(
    ("metadata"->>'type') IN (${DURABLE_MEMORY_TYPES.map((type) => `'${type}'`).join(",")})
    OR ("metadata"->>'source') = 'seed'
  )`;
}

export async function addMemory(
  agentId: string,
  content: string,
  metadata?: Record<string, unknown>,
) {
  const memoryType = typeof metadata?.type === "string" ? metadata.type : null;
  const memorySource = typeof metadata?.source === "string" ? metadata.source : null;
  if (!memoryType && memorySource !== "seed") {
    console.warn(
      `[${new Date().toISOString()}] addMemory without metadata.type may be excluded from retrieval`,
    );
  }

  let embedding: number[] | null = null;
  try {
    embedding = await ollamaEmbed(content);
  } catch (err) {
    console.warn(
      `[${new Date().toISOString()}] Embedding failed, storing memory without vector:`,
      err instanceof Error ? err.message : err,
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
      row.id,
    );
  }
}

export async function getRecentMemories(agentId: string, limit = 10): Promise<string> {
  const memories = await db.$queryRawUnsafe<Array<{ content: string }>>(
    `SELECT "content"
       FROM "AgentMemory"
      WHERE "agentId" = $1
        AND ${buildDurableMemoryWhereClause()}
      ORDER BY "createdAt" DESC
      LIMIT $2`,
    agentId,
    limit,
  );
  return memories.map((m: { content: string }) => m.content).join("\n");
}

export async function getRelevantMemories(agentId: string, query: string, k = 5): Promise<string> {
  let embedding: number[];
  try {
    embedding = await ollamaEmbed(query);
  } catch {
    return getRecentMemories(agentId, k);
  }

  const rows = await db.$queryRawUnsafe<Array<{ content: string }>>(
    `SELECT "content"
       FROM "AgentMemory"
      WHERE "agentId" = $1
        AND "embedding" IS NOT NULL
        AND ${buildDurableMemoryWhereClause()}
      ORDER BY "embedding" <=> $2::vector
      LIMIT $3`,
    agentId,
    toVectorLiteral(embedding),
    k,
  );

  if (rows.length === 0) return getRecentMemories(agentId, k);
  return rows.map((r: { content: string }) => r.content).join("\n");
}
