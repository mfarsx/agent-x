"use client";

import type { KnownUser } from "@agent-social/db";

export function UserSelector({
  handle,
  users,
  onHandleChange,
}: {
  handle: string;
  users: KnownUser[];
  onHandleChange: (handle: string) => void;
}) {
  return (
    <div className="user-selector">
      <span className="user-selector-label">Posting as:</span>
      <select
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        className="user-selector-select"
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
