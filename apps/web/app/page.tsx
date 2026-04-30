import { getLatestFeed } from "@agent-social/db";
import { FeedShell } from "./components/FeedShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await getLatestFeed();

  return (
    <main className="shell">
      <FeedShell feed={feed} />
    </main>
  );
}
