import type { KnownUser } from "@agent-social/db";
import Link from "next/link";
import { Brand } from "./Brand";
import { HandleSwitcher } from "./HandleSwitcher";

export function MobileHeader({
  currentHandle,
  demoIdentityEnabled,
  operatorUiEnabled,
  users,
}: {
  currentHandle: string;
  demoIdentityEnabled: boolean;
  operatorUiEnabled: boolean;
  users: KnownUser[];
}) {
  return (
    <>
      <Brand />
      {operatorUiEnabled && <Link href="/operator">Operator</Link>}
      {demoIdentityEnabled && <HandleSwitcher initialHandle={currentHandle} users={users} />}
    </>
  );
}
