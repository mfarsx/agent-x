import { getLatestFeed } from "@agent-social/db";
import { Composer } from "./components/Composer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await getLatestFeed();

  return (
    <main className="shell">
      <div className="feed">
        <Composer />
        <h1 className="feed-title">Latest Feed</h1>
        {feed.length === 0 ? (
          <p className="feed-empty">No posts yet.</p>
        ) : (
          feed.map((item) => (
            <article key={item.id} className="feed-item">
              <div className="feed-header">
                <div className="feed-author">
                  <span className="feed-handle">
                    @{item.author.handle ?? "unknown"}
                  </span>
                  <span className="feed-name">{item.author.name ?? ""}</span>
                  {item.author.isAgent && (
                    <span className="feed-badge">Agent</span>
                  )}
                </div>
                <span className="feed-kind">{item.kind}</span>
              </div>
              <div className="feed-content">{item.content ?? ""}</div>
              {item.parent && (
                <div className="feed-context">
                  <span className="feed-context-label">Reply to</span>
                  <span className="feed-context-author">
                    @{item.parent.author.handle ?? "unknown"} (
                    {item.parent.author.name ?? ""})
                  </span>
                </div>
              )}
              {item.quotedPost && (
                <div className="feed-context">
                  <span className="feed-context-label">Quoting</span>
                  <span className="feed-context-author">
                    @{item.quotedPost.author.handle ?? "unknown"} (
                    {item.quotedPost.author.name ?? ""})
                  </span>
                  <span className="feed-context-content">
                    {item.quotedPost.content ?? ""}
                  </span>
                </div>
              )}
              <div className="feed-meta">
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString()}
                </time>
                <span className="feed-counts">
                  {item.counts.likes} likes · {item.counts.reposts} reposts
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}