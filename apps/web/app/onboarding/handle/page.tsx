import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isValidHandle } from "../../../lib/session";
import { HandleClaimPanel } from "./handle-claim-panel";

export const dynamic = "force-dynamic";

export default async function HandleOnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (isValidHandle(session.user.handle)) {
    redirect("/");
  }

  return <HandleClaimPanel suggestedHandle={session.user.name ?? session.user.email ?? ""} />;
}
