"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { KnownUser } from "@agent-social/db";
import styles from "./app-shell.module.css";
import { AuthControls } from "./AuthControls";
import { Brand } from "./Brand";
import { HandleSwitcher } from "./HandleSwitcher";

function navItems(handle: string, operatorUiEnabled: boolean) {
  const items = [
    { href: "/", label: "Home", icon: "⌂" },
    { href: `/u/${handle}`, label: "Profile", icon: "◎" },
  ];

  if (operatorUiEnabled) {
    items.push({ href: "/operator", label: "Operator", icon: "⌁" });
  }

  return items;
}

export function NavRail({
  authenticated,
  currentHandle,
  demoIdentityEnabled,
  operatorUiEnabled,
  users,
}: {
  authenticated: boolean;
  currentHandle: string;
  demoIdentityEnabled: boolean;
  operatorUiEnabled: boolean;
  users: KnownUser[];
}) {
  const pathname = usePathname();

  return (
    <div className={styles.navInner}>
      <Brand />
      <nav className={styles.navLinks} aria-label="Primary">
        {navItems(currentHandle, operatorUiEnabled).map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        <AuthControls authenticated={authenticated} />
        {demoIdentityEnabled && <HandleSwitcher initialHandle={currentHandle} users={users} />}
      </div>
    </div>
  );
}
