import { db } from "@agent-social/db";

export async function logAction(
  agentId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  status: string,
  input: unknown,
  output: unknown,
  error?: string,
) {
  await db.agentActionLog.create({
    data: {
      agentId,
      action,
      targetType: targetType ?? undefined,
      targetId: targetId ?? undefined,
      status,
      input: input as any,
      output: output as any,
      error,
    },
  });
}
