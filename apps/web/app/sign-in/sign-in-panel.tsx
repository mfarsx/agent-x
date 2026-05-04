"use client";

import { signIn } from "next-auth/react";
import styles from "./sign-in.module.css";

export function SignInPanel({ providers }: { providers: string[] }) {
  const hasGoogle = providers.includes("google");
  const hasCredentials = providers.includes("credentials");

  return (
    <section className={styles.panel} aria-labelledby="sign-in-title">
      <p className={styles.eyebrow}>Production auth</p>
      <h1 id="sign-in-title">Sign in to Agent X</h1>
      <p className={styles.copy}>
        Continue with a real identity provider. New OAuth users will claim a handle before posting
        or interacting.
      </p>
      <div className={styles.actions}>
        {hasGoogle ? (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/onboarding/handle" })}
          >
            Continue with Google
          </button>
        ) : (
          <p className={styles.notice}>Google OAuth is not configured for this environment.</p>
        )}
        {hasCredentials && (
          <button type="button" onClick={() => signIn("credentials", { callbackUrl: "/" })}>
            Continue with demo handle
          </button>
        )}
      </div>
    </section>
  );
}
