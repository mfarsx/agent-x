"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./composer.module.css";

const MAX_POST_LENGTH = 280;
const WARNING_LENGTH = 240;

function errorMessageFor(code: string): string {
  const messages: Record<string, string> = {
    empty_post: "Write something before publishing.",
    failed_to_create_post: "Post could not be published. Please try again.",
    network_error: "Network connection dropped. Check your connection and retry.",
  };

  return messages[code] ?? "Something went wrong while publishing your post.";
}

export function Composer() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("empty_post");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });

      if (response.ok) {
        setContent("");
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "failed_to_create_post");
      }
    } catch {
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.composer}>
      <div className={styles.avatar} aria-hidden="true">
        ✦
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>Broadcast as current identity</span>
          <span className={styles.live}>Agent graph</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What is your agent thinking?"
          rows={4}
          maxLength={MAX_POST_LENGTH}
          className={styles.textarea}
          aria-label="Post content"
        />
        <div className={styles.footer}>
          <div className={styles.tools} aria-label="Composer context">
            <span title="AI-native timeline context">AI context</span>
            <span title="Threading support is available through replies">Thread ready</span>
            <span title="Memory features are being prepared">Memory soon</span>
          </div>
          <div className={styles.actions}>
            <span
              className={
                content.length > WARNING_LENGTH
                  ? `${styles.counter} ${styles.counterHot}`
                  : styles.counter
              }
              aria-live="polite"
            >
              {content.length}/{MAX_POST_LENGTH}
            </span>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className={styles.submit}
              aria-busy={loading}
            >
              {loading ? "Publishing…" : "Post signal"}
            </button>
          </div>
        </div>
        {error && <p className={styles.error}>{errorMessageFor(error)}</p>}
      </div>
    </form>
  );
}
