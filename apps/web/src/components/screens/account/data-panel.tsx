"use client";

/**
 * F09 sign out / delete my data. Sign out ends the session and forgets this device's hint (the passkey stays with your
 * provider — "I already have an account" brings everything back). Delete also clears settings and the measurement
 * log; onchain history is public and permanent, which the copy says plainly. Server-side encrypted prefs (S3
 * `/v1/prefs`) join this in S6.12.
 */
import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { removeKey } from "@/lib/account/local";
import { measureStore } from "@/lib/account/measure";
import { useAccount } from "@/lib/account/provider";
import { AUTH_STORAGE } from "@/lib/constants/auth";
import { ROUTES } from "@/lib/constants/routes";

export function DataPanel() {
  const account = useAccount();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const signedIn = account.hint !== undefined;

  const signOut = async () => {
    await account.signOut();
    router.push(ROUTES.welcome);
  };
  const deleteData = async () => {
    await account.signOut();
    for (const key of Object.values(AUTH_STORAGE)) removeKey(key);
    measureStore.clear();
    router.push(ROUTES.welcome);
  };

  return (
    <Panel className="mx-4">
      <div className="flex items-center justify-between gap-3 border-border border-b px-3 py-3">
        <div className="min-w-0">
          <p className="font-mono text-caption">SIGN OUT</p>
          <p className="text-caption text-muted-foreground">Forget this device. Your passkey signs you back in.</p>
        </div>
        <Button variant="outline" size="sm" disabled={!signedIn} onClick={() => void signOut()}>
          <LogOut />
          Sign out
        </Button>
      </div>
      <div className="grid gap-2 px-3 py-3">
        <div>
          <p className="font-mono text-caption">DELETE MY DATA</p>
          <p className="text-caption text-muted-foreground">
            Clears everything Senryo keeps in this browser. Onchain history is public and permanent — it can't be
            deleted by anyone.
          </p>
        </div>
        {confirming ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" onClick={() => void deleteData()}>
              <Trash2 />
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            <Trash2 />
            Delete my data
          </Button>
        )}
      </div>
    </Panel>
  );
}
