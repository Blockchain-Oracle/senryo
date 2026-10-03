/**
 * Deposit (flow book D1 steps 2–5; plan §0.9 Pool): a keypad sheet over the pool — the typed amount as the figure, a
 * "Pay with AUSD ⌄" chip over every holding (rule 1): AUSD comes from the wallet first, then the trading balance
 * (withdrawn to self); on Mainnet any other verified holding is swapped to AUSD inside the same operation — its
 * minimum covers the deposit, impact over 1 % warns and over 5 % blocks; Practice has no aggregator, so the chip says
 * "Practice: AUSD only". Presets $10 / $25 / $50 / Max (what the chosen asset brings, capped by the pool's room),
 * what it composes ("Swap MON → AUSD · Approve AUSD · Deposit"), "≈ n sLP", and one slide — "… · passkey" when a swap
 * leg or the session's move cap asks for one, which signs every step. The pool page shows the outcome.
 */
import type { LpSnapshot } from "@senryo/chain";
import { DECIMALS, formatUnits, parseUnits } from "@senryo/core";
import { LP_SHARE_DECIMALS, stepsLine, useQueryEnv } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { applyKey, Keypad } from "~/components/trade/Keypad";
import { Preset } from "~/components/trade/Preset";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { DetailRow } from "~/features/markets/Disclosure";
import { AssetPicker } from "~/features/money/AssetPicker";
import { payWithReason, practiceNote, swappableUsd6, usePaySwap } from "~/features/money/pay-with";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { usePreparedOperation } from "~/features/money/useMoneyOperation";
import { AssetChip } from "~/features/send/AmountStep";
import { useOutcome } from "~/features/trade/OutcomeNote";
import { moneySymbol, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { LP_DEPOSIT_CHIPS_USD, LP_MIN_DEPOSIT_USD6 } from "./constants";
import { type PoolDeposit, poolDepositOperation, poolDepositSteps } from "./deposit-op";
import type { useLp } from "./useLp";

type Lp = ReturnType<typeof useLp>;

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
  const env = useQueryEnv();
  const network = useNetwork();
  const money = useMoneyAssets();
  const [text, setText] = useState("");
  const [payKey, setPayKey] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string>();
  const parsed = parseUnits(text === "" ? "0" : text, DECIMALS.usd6);
  const amount = parsed.ok ? parsed.value : 0n;
  const ausd = money.assets.find((a) => a.collateral === "AUSD");
  const payWith = (payKey ? money.find(payKey) : undefined) ?? ausd;
  const direct = payWith?.collateral === "AUSD";
  const swap = usePaySwap(env.chainId, direct ? undefined : payWith, amount, lp.address);
  const have = !payWith ? 0n : direct ? payWith.wallet + payWith.tradingFree : swappableUsd6(payWith, env.chainId);
  const max = have < pool.maxDeposit ? have : pool.maxDeposit;
  const passkey = !direct || lp.confirmFor(amount) === "passkey";
  // What the user chose, not the plan's live state: once the swap leg lands, the paying asset's balance drops and its
  // plan reads differently — that must not stop the deposit. The plan's figures re-arm the slide instead (reviewKey).
  const guard = useReviewGuard([network.chainId, lp.address, amount, payWith?.key].join(":"));
  const { unresolved } = useOutcome(lp.trace.events);
  const busy = lp.trace.running || unresolved;
  const deposit: PoolDeposit | undefined =
    payWith && lp.vaultAddress && lp.trading
      ? {
          amountUsd6: amount,
          payWith,
          swap,
          vault: lp.vaultAddress,
          allowance: pool.allowance,
          positionBitmap: lp.trading.positionBitmap,
          passkey,
        }
      : undefined;
  const blocked =
    amount <= 0n
      ? "Enter an amount"
      : amount < LP_MIN_DEPOSIT_USD6
        ? `Minimum ${usd(LP_MIN_DEPOSIT_USD6)}`
        : amount > pool.maxDeposit
          ? "Pool full"
          : amount > have
            ? `Not enough ${payWith?.symbol ?? ""}`
            : swap.status === "blocked"
              ? swap.reason
              : swap.status === "quoting"
                ? "Getting a quote"
                : undefined;
  const reviewKey =
    deposit && !blocked
      ? [amount, payWith?.key, swap.status === "ok" ? swap.quote.quote.minOut : swap.status, passkey].join(":")
      : undefined;
  const prepared = usePreparedOperation(lp.runner, reviewKey, async () => {
    if (!deposit || !lp.address) return undefined;
    const steps = await poolDepositSteps(env, lp.address, deposit);
    return steps ? poolDepositOperation(env, lp.address, deposit, steps, guard) : undefined;
  });
  const plan = prepared.data;
  const why = blocked ?? problem ?? (plan && !plan.ok ? plan.block : undefined);
  const shares =
    pool.totalAssets > 0n && pool.totalSupply > 0n ? (amount * pool.totalSupply) / pool.totalAssets : amount;
  const impact = swap.status === "ok" ? swap.quote.quote.impact : undefined;
  return (
    <ChildSheet open={open} onClose={onClose} title="Deposit" subtitle="Into the Senryo pool">
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
      {payWith ? (
        <View style={styles.chip}>
          <AssetChip asset={payWith} onPress={() => setPicking(true)} />
          {network.key === "testnet" ? (
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
              {practiceNote()}
            </Text>
          ) : null}
        </View>
      ) : null}
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
          accessibilityLabel="Max: what this asset brings, up to the pool's room"
          disabled={max <= 0n}
          onPress={() => setText(formatUnits(max, DECIMALS.usd6, DECIMALS.cents, { grouping: false }))}
        />
      </View>
      <Keypad onKey={(k) => setText((t) => applyKey(t, k))} />
      {amount > 0n ? (
        <View>
          <DetailRow label="You get" value={`≈ ${formatUnits(shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
          {plan?.ok ? <DetailRow label="Steps" value={stepsLine(plan.op.steps)} /> : null}
          {impact === "warn" ? <DetailRow label="Price impact" value="Over 1%" /> : null}
        </View>
      ) : null}
      <SlideToConfirm
        label={why ?? (passkey ? "Slide to deposit · passkey" : "Slide to deposit")}
        disabled={why !== undefined || busy || !lp.ready || !plan?.ok}
        busy={busy || prepared.isFetching}
        resetKey={[network.chainId, lp.address, reviewKey ?? "", passkey].join("|")}
        onConfirm={() => {
          if (!plan?.ok) return;
          // The typed amount stays: clearing it would change the reviewed intent the guard holds.
          onClose();
          void lp.deposit(plan.op).then(setProblem);
        }}
      />
      <ChildSheet open={picking} onClose={() => setPicking(false)} title="Pay with">
        <AssetPicker
          assets={money.assets}
          other={money.other}
          selectedKey={payWith?.key}
          reasonFor={(a) => payWithReason(a, "pool", env.chainId)}
          onPick={(a) => {
            setPayKey(a.key);
            setProblem(undefined);
            setPicking(false);
          }}
        />
      </ChildSheet>
    </ChildSheet>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  chip: { alignItems: "center", gap: SPACE.xxs },
  presets: { flexDirection: "row", gap: SPACE.sm },
});
