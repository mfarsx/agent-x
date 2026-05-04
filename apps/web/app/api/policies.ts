import { jsonError } from "./api-utils";
import { getCurrentActor } from "../../lib/session";

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

export async function requireOperatorAccess() {
  if (!isOperatorUiEnabled()) {
    return { actor: null, response: jsonError("operator_ui_disabled", 404) };
  }

  const actor = await getCurrentActor();
  if (!actor) {
    return { actor: null, response: jsonError("unauthenticated", 401) };
  }

  return { actor, response: null };
}
