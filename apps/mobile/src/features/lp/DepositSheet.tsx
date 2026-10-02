/**
 * Deposit (flow book D1 steps 2–5; plan §0.9 Pool): a keypad sheet over the pool — the typed amount as the figure,
 * where the AUSD comes from (the trading balance, withdrawn to self first, or wallet AUSD), presets $10 / $25 / $50 /
 * Max (the source's balance capped by the pool's room), what it composes (Withdraw → Approve → Deposit), "≈ n sLP",
 * and one slide — "Slide to deposit", or "… · passkey" above the session's move cap, where one passkey signs every leg
 * (defect 13). Typing more than the pool's room says "Pool full" before the slide. The slide closes the sheet and the
 * pool page shows the outcome.
 */

import type { LpSnapshot } from "@senryo/chain";
import { DECIMALS, formatUnits, parseUnits } from "@senryo/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { applyKey, Keypad } from "~/components/trade/Keypad";
import { Preset } from "~/components/trade/Preset";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { DetailRow } from "~/features/markets/Disclosure";
import { useOutcome } from "~/features/trade/OutcomeNote";
import { moneySymbol, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { LP_DEPOSIT_CHIPS_USD, LP_MIN_DEPOSIT_USD6 } from "./constants";
import type { DepositSource, useLp } from "./useLp";

type Lp = ReturnType<typeof useLp>;

const SOURCES = [
  { value: "trading", label: "Trading balance" },
  { value: "wallet", label: "Wallet AUSD" },
] as const;

/** sLP shares come in 6 decimals, like the AUSD they're minted against. */
const SHARE_DECIMALS = DECIMALS.usd6;

export function DepositSheet({
  open,
  onClose,
  lp,
  pool,
}: {
  open: boolean;
  onClose: () => void;
  lp: Lp;
  pool: LpSnapshot;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const [text, setText] = useState("");
  const [source, setSource] = useState<DepositSource>(lp.available.trading > 0n ? "trading" : "wallet");
  const parsed = parseUnits(text === "" ? "0" : text, DECIMALS.usd6);
  const amount = parsed.ok ? parsed.value : 0n;
  const have = lp.available[source];
  const max = have < pool.maxDeposit ? have : pool.maxDeposit;
  const guard = useReviewGuard([network.chainId, lp.address, amount, source].join(":"));
  const { unresolved } = useOutcome(lp.trace.events);
  const busy = lp.trace.running || unresolved;
  const passkey = lp.confirmFor(amount) === "passkey";
  const steps = [
    ...(source === "trading" ? ["Withdraw"] : []),
    ...(pool.allowance < amount ? ["Approve"] : []),
    "Deposit",
  ];
  const shares =
    pool.totalAssets > 0n && pool.totalSupply > 0n ? (amount * pool.totalSupply) / pool.totalAssets : amount;
  const blocked =
    amount <= 0n
      ? "Enter an amount"
      : amount < LP_MIN_DEPOSIT_USD6
        ? `Minimum ${usd(LP_MIN_DEPOSIT_USD6)}`
        : amount > pool.maxDeposit
          ? "Pool full"
          : amount > have
            ? "Not enough in this balance"
            : undefined;
  return (
    <ChildSheet open={open} onClose={onClose} title="Deposit" subtitle="Into the Senryo pool">
      {
        <>
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[TYPE.displayMargin, styles.center, { color: text === "" ? color.text3 : color.ink }]}
            accessibilityLabel={`Deposit ${text === "" ? "not set" : `${text} dollars`}`}
          >
            {moneySymbol()}
            {text === "" ? "0" : text}
          </Text>
          <View style={styles.chips}>
            <ChipRow options={SOURCES} value={source} onChange={setSource} label="Pay from" />
          </View>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.center, { color: color.text3 }]}>
            {usd(have)} available · {usd(pool.maxDeposit, 0)} room left
          </Text>
          <View style={styles.presets}>
            {LP_DEPOSIT_CHIPS_USD.map((c) => (
              <Preset
                key={String(c)}
                label={`${moneySymbol()}${c}`}
                accessibilityLabel={`Deposit ${moneySymbol()}${c}`}
                onPress={() => setText(String(c))}
              />
            ))}
            <Preset
              label="Max"
              accessibilityLabel="Max: this balance, up to the pool's room"
              disabled={max <= 0n}
              onPress={() => setText(formatUnits(max, DECIMALS.usd6, DECIMALS.cents, { grouping: false }))}
            />
          </View>
          <Keypad onKey={(k) => setText((t) => applyKey(t, k))} />
          {amount > 0n ? (
            <View>
              <DetailRow label="You get" value={`≈ ${formatUnits(shares, SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
              <DetailRow label="Steps" value={steps.join(" → ")} />
            </View>
          ) : null}
          <SlideToConfirm
            label={blocked ?? (passkey ? "Slide to deposit · passkey" : "Slide to deposit")}
            disabled={blocked !== undefined || busy || !lp.ready}
            busy={busy}
            resetKey={[network.chainId, lp.address, amount, source, passkey].join("|")}
            onConfirm={() => {
              // The typed amount stays: clearing it would change the reviewed intent the guard holds.
              onClose();
              void lp.deposit(amount, source, guard);
            }}
          />
        </>
      }
    </ChildSheet>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  chips: { alignItems: "center" },
  presets: { flexDirection: "row", gap: SPACE.sm },
});
