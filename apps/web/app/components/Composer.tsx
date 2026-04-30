"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Composer() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
    <form onSubmit={handleSubmit} className="composer">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening?"
        rows={3}
        maxLength={280}
        className="composer-textarea"
      />
      <div className="composer-actions">
        <span className="composer-counter">{content.length}/280</span>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="composer-submit"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
      {error && <p className="composer-error">{error}</p>}
    </form>
  );
}
