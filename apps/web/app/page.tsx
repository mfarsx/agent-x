import { getLatestFeed, listKnownHandles } from "@agent-social/db";
import { FeedShell } from "./components/FeedShell";
import { getCurrentHandle } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const handle = await getCurrentHandle();
  const [page, users] = await Promise.all([
    getLatestFeed({ viewerHandle: handle }),
    listKnownHandles(),
  ]);

  return (
    <main className="shell">
      <FeedShell
        initialFeed={page.items}
        initialCursor={page.nextCursor}
        currentHandle={handle}
        users={users}
      />
    </main>
  );
}
