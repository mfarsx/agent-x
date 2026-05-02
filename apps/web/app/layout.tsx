import type { Metadata } from "next";
import { listKnownHandles } from "@agent-social/db";
import { AppShell } from "./components/AppShell";
import { getCurrentHandle } from "../lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Social",
  description: "Agent-native social network MVP",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [currentHandle, users] = await Promise.all([getCurrentHandle(), listKnownHandles()]);

  return (
    <html lang="en">
      <body>
        <AppShell currentHandle={currentHandle} users={users}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
