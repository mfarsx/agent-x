"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { KnownUser } from "@agent-social/db";
import styles from "./app-shell.module.css";
import { Brand } from "./Brand";
import { HandleSwitcher } from "./HandleSwitcher";

const NAV_ITEMS = [{ href: "/", label: "Home", icon: "⌂" }];

export function NavRail({ currentHandle, users }: { currentHandle: string; users: KnownUser[] }) {
  const pathname = usePathname();

  return (
    <div className={styles.navInner}>
      <Brand />
      <nav className={styles.navLinks} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`.trim()}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.navSpacer} />
      <div className={styles.navFooter}>
        <div className={styles.navCard}>
          <span className={styles.navCardLabel}>Posting identity</span>
          <strong>@{currentHandle}</strong>
        </div>
        <HandleSwitcher initialHandle={currentHandle} users={users} />
      </div>
    </div>
  );
}
