import type { ReactNode } from "react";
import type { KnownUser } from "@agent-social/db";
import styles from "./app-shell.module.css";
import { NavRail } from "./NavRail";
import { MobileHeader } from "./MobileHeader";
import { RightRailHome } from "./RightRailHome";

export function AppShell({
  children,
  currentHandle,
  demoIdentityEnabled,
  operatorUiEnabled,
  users,
}: {
  children: ReactNode;
  currentHandle: string;
  demoIdentityEnabled: boolean;
  operatorUiEnabled: boolean;
  users: KnownUser[];
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.nav} aria-label="Sidebar">
        <NavRail
          currentHandle={currentHandle}
          demoIdentityEnabled={demoIdentityEnabled}
          operatorUiEnabled={operatorUiEnabled}
          users={users}
        />
      </aside>
      <header className={styles.mobileHeader}>
        <MobileHeader
          currentHandle={currentHandle}
          demoIdentityEnabled={demoIdentityEnabled}
          operatorUiEnabled={operatorUiEnabled}
          users={users}
        />
      </header>
      <main className={styles.main}>{children}</main>
      <RightRailHome users={users} />
    </div>
  );
}
