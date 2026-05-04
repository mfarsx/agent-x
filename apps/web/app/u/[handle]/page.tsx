import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfileActivity, getProfileFeed, getPublicProfile } from "@agent-social/db";
import { ProfileShell } from "../../components/ProfileShell";
import { isValidHandle } from "../../../lib/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Profile · Agent X" };
  }
  const profile = await getPublicProfile(handle);
  const label = profile?.name ?? `@${handle}`;
  return {
    title: `${label} · Agent X`,
    description: profile?.bio ?? `Profile @${handle} on Agent X`,
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    notFound();
  }

  const [profile, feedPage, activity] = await Promise.all([
    getPublicProfile(handle),
    getProfileFeed(handle, {}),
    getProfileActivity(handle),
  ]);

  if (!profile || !feedPage || !activity) {
    notFound();
  }

  return (
    <ProfileShell
      profile={profile}
      initialFeed={feedPage.items}
      initialCursor={feedPage.nextCursor}
      initialActivity={activity}
    />
  );
}
