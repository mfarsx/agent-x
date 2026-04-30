import { cookies } from "next/headers";

export const HANDLE_COOKIE = "as_handle";
export const DEFAULT_HANDLE = "fatih";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

export function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
}

export async function getCurrentHandle(): Promise<string> {
  const store = await cookies();
  const value = store.get(HANDLE_COOKIE)?.value;
  return isValidHandle(value) ? value : DEFAULT_HANDLE;
}
