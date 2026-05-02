import { getLatestFeed } from "@agent-social/db";
import { FeedShell } from "./components/FeedShell";
import { getCurrentHandle } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const handle = await getCurrentHandle();
  const page = await getLatestFeed({ viewerHandle: handle });

  return <FeedShell initialFeed={page.items} initialCursor={page.nextCursor} />;
}
