"use client";

/**
 * Add money (flow book B1–B5, B15; Fomo F20 "Deposit with"): centred title, rich rows with the marks of what each way
 * moves through. Practice leads with "Get practice money" (the claim runs right in its row) and "Redeem a code"; then
 * Crypto on Monad and From an exchange (Receive). Card or bank is Ramp on Mainnet, so in Practice it carries the same
 * "Mainnet only" lock as the phone; other chains come in through the bridge flows, not built on the web yet.
 */
import { isDeployed } from "@senryo/chain";
import { collateralId, ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { Gift, Loader2, Lock } from "lucide-react";
import { useId, useState } from "react";
import { MarkCluster } from "@/components/identity/mark-cluster";
import { ListRow } from "@/components/kit/list-row";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/lib/account/provider";
import { useVoucher, type VoucherPhase } from "@/lib/account/use-voucher";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW, MARK_SMALL } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import { PracticeMoneyRow } from "./practice-money";

const VOUCHER_WORDS: Record<string, string> = {
  VOUCHER_INVALID: "Code not found",
  VOUCHER_USED: "Code already used",
  VOUCHER_CAP_REACHED: "All vouchers used",
  RATE_LIMITED: "Too many tries · later",
  GEO_BLOCKED: "Not available in your region",
  NOT_DEPLOYED: "Not live on this network",
  RELAY_REVERTED: "Didn’t settle · nothing changed",
  FORMAT: "6–32 letters, digits or dashes",
  AUTH: "Passkey didn’t confirm",
};

function voucherLine(phase: VoucherPhase): string | undefined {
  switch (phase.kind) {
    case "working":
      return "Adding…";
    case "pending":
      return "Pending · check again shortly";
    case "done":
      return `${money(phase.creditUsd6)} added · in your Assets`;
    case "failed":
      return VOUCHER_WORDS[phase.code] ?? "Didn’t go through · try again";
    default:
      return undefined;
  }
}

function VoucherField() {
  const id = useId();
  const { phase, redeem, check } = useVoucher();
  const [code, setCode] = useState("");
  const line = voucherLine(phase);
  const busy = phase.kind === "working";
  return (
    <form
      className="grid gap-2 pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (phase.kind === "pending") void check();
        else void redeem(code.trim().toUpperCase());
      }}
    >
      <label htmlFor={id} className="sr-only">
        Voucher code
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE-1234"
          autoComplete="off"
          spellCheck={false}
          disabled={busy || phase.kind === "pending"}
          className="font-mono"
        />
        <Button type="submit" disabled={busy || (phase.kind !== "pending" && code.trim().length === 0)}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {phase.kind === "pending" ? "Check" : "Redeem"}
        </Button>
      </div>
      {line ? (
        <p
          aria-live="polite"
          className={
            phase.kind === "failed"
              ? "text-meta text-down"
              : phase.kind === "done"
                ? "text-meta text-up"
                : "text-meta text-text-2"
          }
        >
          {line}
        </p>
      ) : null}
    </form>
  );
}

export function AddMoneyScreen() {
  const signedIn = useAccount().hint !== undefined;
  const chainId = ACTIVE_NETWORK.chainId;
  const practice = ACTIVE_NETWORK.key === "testnet";
  const vouchers = isDeployed(chainId, "StarterDrip") && isDeployed(chainId, "SenryoCore");
  const [code, setCode] = useState(false);
  const guard = (href: string) => (signedIn ? href : ROUTES.welcome);
  return (
    <Column>
      <PageHeader title="Deposit with" back={ROUTES.home} />
      <div className="pt-2">
        {practice && signedIn ? <PracticeMoneyRow /> : null}
        {vouchers ? (
          <>
            <ListRow
              leading={<Gift className="size-10 rounded-full bg-raised-2 p-2.5 text-gold" aria-hidden />}
              title="Redeem a code"
              subtitle="A code adds money"
              {...(signedIn ? { onClick: () => setCode(!code) } : { href: ROUTES.welcome })}
            />
            {code && signedIn ? <VoucherField /> : null}
          </>
        ) : null}
        <ListRow
          leading={<MarkCluster ids={[ids.evmChain(chainId)]} size={MARK_ROW} />}
          title="Crypto on Monad"
          subtitle="Any token"
          href={guard(ROUTES.receive)}
        />
        <ListRow
          leading={<MarkCluster ids={[ids.exchange("coinbase"), ids.exchange("binance")]} size={MARK_SMALL} />}
          title="From an exchange"
          subtitle="Coinbase, Binance, Kraken"
          href={guard(`${ROUTES.receive}?from=exchange`)}
        />
        <ListRow
          leading={
            <MarkCluster
              ids={[collateralId(chainId, "USDC"), collateralId(chainId, "AUSD"), ids.native(chainId, "MON")]}
              size={MARK_SMALL}
            />
          }
          title="Card or bank"
          subtitle={practice ? "Mainnet only" : "USDC, AUSD or MON · Ramp"}
          trailing={practice ? <Lock className="size-4 text-text-3" aria-label="Mainnet only" /> : null}
          className={practice ? "opacity-60" : undefined}
        />
        <ListRow
          leading={
            <MarkCluster
              ids={[ROUTE_CHAIN_ID.ethereum, ROUTE_CHAIN_ID.base, ROUTE_CHAIN_ID.solana]}
              size={MARK_SMALL}
            />
          }
          title="From another chain"
          subtitle="On the Senryo app"
          trailing={<Lock className="size-4 text-text-3" aria-label="On the Senryo app" />}
          className="opacity-60"
        />
      </div>
    </Column>
  );
}
