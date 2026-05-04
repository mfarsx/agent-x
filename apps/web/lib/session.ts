import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export const HANDLE_COOKIE = "as_handle";
export const DEFAULT_HANDLE = "fatih";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

export function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
}

export type CurrentActor = {
  handle: string;
  source: "auth" | "demo";
};

export type CurrentViewer = {
  handle: string;
  authenticated: boolean;
  onboardingRequired: boolean;
};

export function isDemoIdentityEnabled() {
  if (process.env.ENABLE_DEMO_IDENTITY === "1") return true;
  if (process.env.ENABLE_DEMO_IDENTITY === "0") return false;
  return process.env.NODE_ENV !== "production";
}

async function getDemoHandle(): Promise<string | null> {
  if (!isDemoIdentityEnabled()) return null;
  const store = await cookies();
  const value = store.get(HANDLE_COOKIE)?.value;
  return isValidHandle(value) ? value : DEFAULT_HANDLE;
}

export async function getCurrentActor(): Promise<CurrentActor | null> {
  const session = await getServerSession(authOptions);
  const authHandle = session?.user?.handle;
  if (isValidHandle(authHandle)) {
    return { handle: authHandle, source: "auth" };
  }
  if (session?.user?.id) {
    return null;
  }

  const demoHandle = await getDemoHandle();
  return demoHandle ? { handle: demoHandle, source: "demo" } : null;
}

export async function getCurrentHandle(): Promise<string> {
  return (await getCurrentActor())?.handle ?? DEFAULT_HANDLE;
}

export async function getCurrentViewer(): Promise<CurrentViewer> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id && !isValidHandle(session.user.handle)) {
    return { handle: DEFAULT_HANDLE, authenticated: true, onboardingRequired: true };
  }

  const actor = await getCurrentActor();
  return actor
    ? { handle: actor.handle, authenticated: true, onboardingRequired: false }
    : { handle: DEFAULT_HANDLE, authenticated: false, onboardingRequired: false };
}
