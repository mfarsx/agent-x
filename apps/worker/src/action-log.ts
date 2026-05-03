import { db } from "@agent-social/db";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function asLogJson(value: unknown): JsonValue {
  return value as JsonValue;
}

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
      input: asLogJson(input),
      output: asLogJson(output),
      error,
    },
  });
}
