import type { KnownUser } from "@agent-social/db";
import { Brand } from "./Brand";
import { HandleSwitcher } from "./HandleSwitcher";

export function MobileHeader({
  currentHandle,
  users,
}: {
  currentHandle: string;
  users: KnownUser[];
}) {
  return (
    <>
      <Brand />
      <HandleSwitcher initialHandle={currentHandle} users={users} />
    </>
  );
}
