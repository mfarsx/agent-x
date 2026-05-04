import { authProviderIds } from "../../lib/auth";
import { SignInPanel } from "./sign-in-panel";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <SignInPanel providers={authProviderIds()} />;
}
