"use client";

/**
 * You (flow book F2 own, A7, A10; Fomo F16, the phone's You tab): your profile as others see it — avatar, name, handle,
 * follows, the period hero, Positions · Trades — with Edit profile and Settings. Without a public profile on this
 * network yet: your address, "Set a handle" (setup) and Settings. A guest is invited to create an account.
 */
import { Settings } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/identity/avatar";
import { TabTitle, UtilityCircle } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";
import { ProfileView } from "./profile-view";

const PROFILE_AVATAR = 64;

function NoProfile({ address }: { address: string }) {
  return (
    <div className="grid gap-3 pt-2">
      <Avatar address={address} size={PROFILE_AVATAR} />
      <p className="font-mono text-meta text-text-2">{address}</p>
      <Button asChild size="xl">
        <Link href={ROUTES.setup}>Set a handle</Link>
      </Button>
    </div>
  );
}

export function OwnProfile() {
  const account = useAccount();
  const address = account.hint?.address;
  return (
    <Column className="grid gap-3">
      <TabTitle
        right={
          <UtilityCircle label="Settings" href={ROUTES.account}>
            <Settings className="size-4" />
          </UtilityCircle>
        }
      >
        You
      </TabTitle>
      {account.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : address ? (
        // The public read: what others see. Opening this page never raises the passkey.
        <ProfileView lookup={address} missing={<NoProfile address={address} />} />
      ) : (
        <div className="grid gap-3 py-6 text-center">
          <p className="text-row">Your profile lives in your account</p>
          <Button asChild size="xl">
            <Link href={ROUTES.welcome}>Create account</Link>
          </Button>
        </div>
      )}
    </Column>
  );
}
