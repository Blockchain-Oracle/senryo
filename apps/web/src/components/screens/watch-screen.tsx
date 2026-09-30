"use client";

/**
 * Watch mode (F91, D-031): any address, read-only — for judges who are geo-blocked or whose authenticator lacks PRF.
 * Nothing here can sign. The portfolio below is the same screen every account sees, still fed by the sample data
 * behind the PREVIEW DATA badge until the indexer/chain reads land (S4/S8 swap-in, D-064).
 */
import { explorerAddressUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { ExternalLink, Eye } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { PortfolioScreen } from "@/components/screens/portfolio-screen";
import { Panel, SectionLabel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/ui/copy-code-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { watchHref } from "@/lib/constants/routes";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function WatchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial);
  const valid = ADDRESS.test(value.trim());
  return (
    <Panel className="mx-4 grid gap-3 p-4">
      <p className="text-caption text-muted-foreground">
        Paste any Senryo account address or open a shared watch link. Read-only: nothing here can move money.
      </p>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) router.push(watchHref(value.trim()));
        }}
      >
        <Label htmlFor={id}>Address</Label>
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={value.length > 0 && !valid}
        />
        {value.length > 0 && !valid ? (
          <p className="text-caption text-down">That isn't an address — it starts with 0x and has 40 hex characters.</p>
        ) : null}
        <Button type="submit" disabled={!valid}>
          <Eye />
          Watch
        </Button>
      </form>
    </Panel>
  );
}

export function WatchScreen() {
  const params = useSearchParams();
  const raw = params.get("address") ?? "";
  if (!ADDRESS.test(raw)) {
    return (
      <div className="mx-auto w-full max-w-2xl pb-10">
        <SectionLabel>Watch an account</SectionLabel>
        <WatchForm initial={raw} />
      </div>
    );
  }
  return (
    <div className="pb-10">
      <div className="mx-auto w-full max-w-2xl">
        <SectionLabel right={<span className="font-mono text-micro text-gold uppercase">Read-only</span>}>
          Watching {shortAddress(raw)}
        </SectionLabel>
        <Panel className="mx-4 grid gap-2 p-3">
          <CopyCode code={raw} display={raw} copiedLabel="Address copied" />
          <a
            href={explorerAddressUrl(ACTIVE_NETWORK.chainId, raw)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-micro text-muted-foreground uppercase tracking-[0.12em] hover:text-foreground"
          >
            {ACTIVE_NETWORK.modeLabel} explorer <ExternalLink className="size-3" aria-hidden />
          </a>
        </Panel>
      </div>
      <PortfolioScreen />
    </div>
  );
}
