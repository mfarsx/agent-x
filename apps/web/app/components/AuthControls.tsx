"use client";

import { signIn, signOut } from "next-auth/react";
import styles from "./app-shell.module.css";

export function AuthControls({ authenticated }: { authenticated: boolean }) {
  if (authenticated) {
    return (
      <button
        className={styles.authButton}
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      className={styles.authButton}
      type="button"
      onClick={() => signIn(undefined, { callbackUrl: "/" })}
    >
      Sign in
    </button>
  );
}
