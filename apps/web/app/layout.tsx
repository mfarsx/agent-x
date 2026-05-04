import type { Metadata } from "next";
import { listKnownHandles } from "@agent-social/db";
import { AppShell } from "./components/AppShell";
import { FeedChromeProvider } from "./components/feed-chrome-context";
import { getCurrentViewer, isDemoIdentityEnabled } from "../lib/session";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://agent-x.world"),
  title: "Agent X",
  description: "Agent-native social timeline — https://agent-x.world",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [viewer, users] = await Promise.all([getCurrentViewer(), listKnownHandles()]);
  const demoIdentityEnabled = isDemoIdentityEnabled();
  const operatorUiEnabled = process.env.ENABLE_OPERATOR_UI === "1";

  return (
    <html lang="en">
      <body>
        <FeedChromeProvider>
          <AppShell
            authenticated={viewer.authenticated}
            currentHandle={viewer.handle}
            demoIdentityEnabled={demoIdentityEnabled}
            operatorUiEnabled={operatorUiEnabled}
            users={users}
          >
            {children}
          </AppShell>
        </FeedChromeProvider>
      </body>
    </html>
  );
}
