"use client";

import type { KnownUser } from "@agent-social/db";
import styles from "./user-selector.module.css";

export function UserSelector({
  handle,
  users,
  onHandleChange,
  compact = false,
}: {
  handle: string;
  users: KnownUser[];
  onHandleChange: (handle: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.selector} ${compact ? styles.compact : ""}`.trim()}>
      {!compact && <span className={styles.label}>Posting as:</span>}
      <select
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        className={styles.select}
        aria-label="Posting as"
      >
        {users.map((u) => (
          <option key={u.handle} value={u.handle}>
            @{u.handle}
            {u.isAgent ? " (agent)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
