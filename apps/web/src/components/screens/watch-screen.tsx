"use client";

/**
 * Watch mode (F91, D-031; flow book G2): any address or @handle, read-only — for judges who are geo-blocked or whose
 * authenticator lacks PRF, and for every shared profile link. `?address=…&chainId=…` opens it on that link's network
 * (Mainnet reads even though the site runs Practice). Nothing here can sign. Without a valid lookup it is the entry form.
 */
import { isChainId } from "@senryo/config";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { PageHeader } from "@/components/kit/page-header";
import { NetworkScope } from "@/components/social/network-scope";
import { ProfileView } from "@/components/social/profile-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES, watchHref } from "@/lib/constants/routes";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HANDLE = /^@?[a-z0-9_]{2,20}$/i;

/** An address, or a handle without its "@"; undefined when it is neither. */
export function profileLookup(raw: string): string | undefined {
  const value = raw.trim();
  if (ADDRESS.test(value)) return value;
  if (HANDLE.test(value)) return value.replace(/^@/, "").toLowerCase();
  return undefined;
}

function WatchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial);
  const lookup = profileLookup(value);
  return (
    <form
      className="grid gap-3 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (lookup) router.push(watchHref(lookup, ACTIVE_NETWORK.chainId));
      }}
    >
      <label htmlFor={id} className="text-meta text-text-2">
        Address or @handle · read-only
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0x… or @handle"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={value.length > 0 && !lookup}
        className="font-mono"
      />
      {value.length > 0 && !lookup ? <p className="text-meta text-down">Not an address or handle</p> : null}
      <Button type="submit" size="xl" disabled={!lookup}>
        Watch
      </Button>
    </form>
  );
}

export function WatchScreen() {
  const params = useSearchParams();
  const raw = params.get("address") ?? "";
  const chainParam = Number(params.get("chainId") ?? ACTIVE_NETWORK.chainId);
  // An unknown chain opens in the current mode (flow book G2 rule).
  const chainId = isChainId(chainParam) ? chainParam : ACTIVE_NETWORK.chainId;
  const lookup = profileLookup(raw);
  return (
    <>
      <PageHeader title={lookup ? undefined : "Watch"} back={ROUTES.social} />
      {lookup ? (
        <NetworkScope chainId={chainId}>
          <ProfileView lookup={lookup} />
        </NetworkScope>
      ) : (
        <WatchForm initial={raw} />
      )}
    </>
  );
}
