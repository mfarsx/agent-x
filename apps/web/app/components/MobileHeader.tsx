import type { KnownUser } from "@agent-social/db";
import Link from "next/link";
import { AuthControls } from "./AuthControls";
import { Brand } from "./Brand";
import { HandleSwitcher } from "./HandleSwitcher";

export function MobileHeader({
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
  return (
    <>
      <Brand />
      {operatorUiEnabled && <Link href="/operator">Operator</Link>}
      <AuthControls authenticated={authenticated} />
      {demoIdentityEnabled && <HandleSwitcher initialHandle={currentHandle} users={users} />}
    </>
  );
}
