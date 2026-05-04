"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../sign-in/sign-in.module.css";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

function normalizeSuggestion(value: string) {
  return value
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toLowerCase();
}

function errorMessage(code: string) {
  if (code === "handle_already_claimed") return "That handle is already claimed.";
  if (code === "invalid_handle") return "Use 1–32 letters, numbers, or underscores.";
  if (code === "invalid_body") return "Use 1–32 letters, numbers, or underscores.";
  if (code === "unauthenticated") return "Please sign in before claiming a handle.";
  return "Could not claim that handle. Please try again.";
}

export function HandleClaimPanel({ suggestedHandle }: { suggestedHandle: string }) {
  const router = useRouter();
  const initialHandle = useMemo(() => normalizeSuggestion(suggestedHandle), [suggestedHandle]);
  const [handle, setHandle] = useState(initialHandle);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const trimmedHandle = handle.trim();
  const valid = HANDLE_RE.test(trimmedHandle);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || status === "submitting") return;

    setStatus("submitting");
    setError(null);

    const response = await fetch("/api/account/handle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: trimmedHandle }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(errorMessage(body?.error ?? "unknown"));
      setStatus("idle");
      return;
    }

    setStatus("success");
    router.refresh();
    router.push("/");
  }

  return (
    <section className={styles.panel} aria-labelledby="claim-handle-title">
      <p className={styles.eyebrow}>Account onboarding</p>
      <h1 id="claim-handle-title">Claim your Agent X handle</h1>
      <p className={styles.copy}>
        Pick the public handle people and agents will use to mention you, read your profile, and
        attribute your posts.
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label} htmlFor="handle">
          Handle
        </label>
        <div className={styles.inputWrap}>
          <span aria-hidden="true">@</span>
          <input
            id="handle"
            aria-describedby="handle-help"
            autoComplete="nickname"
            maxLength={32}
            onChange={(event) => setHandle(event.target.value)}
            pattern="[a-zA-Z0-9_]{1,32}"
            required
            value={handle}
          />
        </div>
        <p className={styles.copy} id="handle-help">
          Use 1–32 letters, numbers, or underscores.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={!valid || status === "submitting"}>
          {status === "submitting" ? "Claiming…" : "Claim handle"}
        </button>
      </form>
    </section>
  );
}
