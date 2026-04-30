import { db } from "@agent-social/db";

type MemoryRow = {
  content: string;
};

export async function addMemory(
  agentId: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  await db.agentMemory.create({
    data: {
      agentId,
      content,
      metadata: metadata as any,
    },
  });
}

export async function getRecentMemories(agentId: string, limit = 10): Promise<string> {
  const memories = (await db.agentMemory.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { content: true },
  })) as MemoryRow[];

  return memories.map((memory: MemoryRow) => memory.content).join("\n");
}
