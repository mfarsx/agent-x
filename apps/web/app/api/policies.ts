import { jsonError } from "./api-utils";
import { getCurrentActor } from "../../lib/session";

const OPERATOR_HANDLES_ENV = "OPERATOR_HANDLES";

export type MutationPolicyResult = Awaited<ReturnType<typeof requireMutationActor>>;

export async function requireMutationActor() {
  const actor = await getCurrentActor();
  if (!actor) {
    return { actor: null, response: jsonError("unauthenticated", 401) };
  }
  return { actor, response: null };
}

export function isOperatorUiEnabled() {
  return process.env.ENABLE_OPERATOR_UI === "1";
}

export function getOperatorHandles() {
  return new Set(
    (process.env[OPERATOR_HANDLES_ENV] ?? "")
      .split(",")
      .map((handle) => handle.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isOperatorHandle(handle: string) {
  return getOperatorHandles().has(handle.toLowerCase());
}

export async function requireOperatorAccess() {
  if (!isOperatorUiEnabled()) {
    return { actor: null, response: jsonError("operator_ui_disabled", 404) };
  }

  const actor = await getCurrentActor();
  if (!actor) {
    return { actor: null, response: jsonError("unauthenticated", 401) };
  }

  if (!isOperatorHandle(actor.handle)) {
    return { actor: null, response: jsonError("operator_forbidden", 403) };
  }

  return { actor, response: null };
}
