import { Prisma } from "@prisma/client";

import { db } from "./client";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type AgentActionLogSummary = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: string;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  error: string | null;
  createdAt: string;
  agent: {
    handle: string | null;
    name: string | null;
  };
};

export type AgentMemorySummary = {
  id: string;
  contentPreview: string;
  metadata: Prisma.JsonValue | null;
  embeddingPresent: boolean;
  createdAt: string;
  updatedAt: string;
  agent: {
    handle: string | null;
    name: string | null;
  };
};

type AgentMemoryRow = {
  id: string;
  content: string;
  metadata: Prisma.JsonValue | null;
  embeddingPresent: boolean;
  createdAt: Date;
  updatedAt: Date;
  agentHandle: string | null;
  agentName: string | null;
};

export type OperatorDashboard = {
  actionLogs: AgentActionLogSummary[];
  memories: AgentMemorySummary[];
};

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function previewContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized;
}

export async function listAgentActionLogs(options: { limit?: number } = {}) {
  const logs = await db.agentActionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: clampLimit(options.limit),
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      status: true,
      input: true,
      output: true,
      error: true,
      createdAt: true,
      agent: { select: { handle: true, name: true } },
    },
  });

  return logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function listAgentMemories(options: { limit?: number; agentHandle?: string } = {}) {
  const limit = clampLimit(options.limit);
  const memories = options.agentHandle
    ? await db.$queryRaw<AgentMemoryRow[]>(Prisma.sql`
        SELECT
          m.id,
          m.content,
          m.metadata,
          (m.embedding IS NOT NULL) AS "embeddingPresent",
          m."createdAt",
          m."updatedAt",
          u.handle AS "agentHandle",
          u.name AS "agentName"
        FROM "AgentMemory" m
        JOIN "User" u ON u.id = m."agentId"
        WHERE u.handle = ${options.agentHandle}
        ORDER BY m."updatedAt" DESC
        LIMIT ${limit}
      `)
    : await db.$queryRaw<AgentMemoryRow[]>(Prisma.sql`
        SELECT
          m.id,
          m.content,
          m.metadata,
          (m.embedding IS NOT NULL) AS "embeddingPresent",
          m."createdAt",
          m."updatedAt",
          u.handle AS "agentHandle",
          u.name AS "agentName"
        FROM "AgentMemory" m
        JOIN "User" u ON u.id = m."agentId"
        ORDER BY m."updatedAt" DESC
        LIMIT ${limit}
      `);

  return memories.map((memory) => ({
    id: memory.id,
    contentPreview: previewContent(memory.content),
    metadata: memory.metadata,
    embeddingPresent: memory.embeddingPresent,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    agent: { handle: memory.agentHandle, name: memory.agentName },
  }));
}

export async function getOperatorDashboard(): Promise<OperatorDashboard> {
  const [actionLogs, memories] = await Promise.all([
    listAgentActionLogs({ limit: 50 }),
    listAgentMemories({ limit: 50 }),
  ]);

  return { actionLogs, memories };
}
