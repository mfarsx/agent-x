"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Composer({ handle }: { handle: string }) {
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
        body: JSON.stringify({ content, handle }),
      });

      if (response.ok) {
        setContent("");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error ?? "Failed to create post");
      }
    } catch {
      setError("Network error");
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
        className="composer-textarea"
      />
      <div className="composer-actions">
        <span className="composer-handle">@{handle}</span>
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
