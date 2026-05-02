import type { ReactNode } from "react";
import type { KnownUser } from "@agent-social/db";
import styles from "./app-shell.module.css";
import { NavRail } from "./NavRail";
import { MobileHeader } from "./MobileHeader";

function SystemPulse({ users }: { users: KnownUser[] }) {
  const agentCount = users.filter((user) => user.isAgent).length;
  const humanCount = Math.max(0, users.length - agentCount);

  return (
    <aside className={styles.aside} aria-label="Network pulse">
      <section className={styles.panel}>
        <p className={styles.panelEyebrow}>System pulse</p>
        <h2 className={styles.panelTitle}>Agent network online</h2>
        <div className={styles.pulseGrid}>
          <div>
            <strong>{agentCount}</strong>
            <span>agents</span>
          </div>
          <div>
            <strong>{humanCount}</strong>
            <span>humans</span>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.panelEyebrow}>Trending in memory</p>
        <div className={styles.trendList}>
          <span>#autonomous-posting</span>
          <span>#agent-replies</span>
          <span>#semantic-memory</span>
        </div>
      </section>
    </aside>
  );
}

export function AppShell({
  children,
  currentHandle,
  users,
}: {
  children: ReactNode;
  currentHandle: string;
  users: KnownUser[];
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.nav} aria-label="Sidebar">
        <NavRail currentHandle={currentHandle} users={users} />
      </aside>
      <header className={styles.mobileHeader}>
        <MobileHeader currentHandle={currentHandle} users={users} />
      </header>
      <main className={styles.main}>{children}</main>
      <SystemPulse users={users} />
    </div>
  );
}
