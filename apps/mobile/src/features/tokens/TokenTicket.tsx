/**
 * The spot token ticket (J11; Phantom P20 / C37 anatomy, the collateral swap's plates): Buy / Sell, You pay over You
 * receive with the flip between them, shares of what you hold, the quote's impact, fee and the minimum the swap is
 * sent with, the route, and the keypad. The primary action names what stops it ("Not enough USDC", "Add MON for gas")
 * until it can send; then one fresh passkey check signs the approvals and the swap, and each send's trace runs to
 * finalized. Real money on Monad mainnet; Practice never reaches a send.
 */
import { SPOT_SLIPPAGE_BPS } from "@senryo/chain";
import { MAINNET_CHAIN_ID, type SpotToken } from "@senryo/config";
import { RISK } from "@senryo/core";
import { collateralId, ids } from "@senryo/identity";
import { spotToken } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { TransactionSheet } from "~/components/sheet/TransactionSheet";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { Keypad, type KeypadKey } from "~/components/trade/Keypad";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { Preset } from "~/components/trade/Preset";
import { SwapFlip, SwapSide } from "~/features/fund/SwapTicket";
import { QuietLine } from "~/features/markets/QuietLine";
import { COLLATERAL_STEPS_BPS } from "~/features/portfolio/constants";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { type TraceWords, TradeTrace } from "~/features/trade/TradeTrace";
import { pct } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { finePct, tokenAmount } from "./format";
import { type TradeBlock, type TradeSide, useTokenTrade } from "./useTokenTrade";

/** The shared outcome contract's words for a swap (review S01). */
const SWAP_WORDS: TraceWords = {
  thing: "swap",
  again: "swap again",
  landed: "Confirmed — your balances show it.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to the ticket",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Swapping",
  success: "Swapped",
};

const SIDES = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
] as const;
/** At most this many decimals are typed, whatever the token carries (beyond it is dust). */
const TYPED_DECIMALS_MAX = 8;
const TYPED_WHOLE_MAX = 12;
const MON_DECIMALS = 18;

/** Next amount text after a key, in the input's own units. */
function applyTokenKey(text: string, key: KeypadKey, decimals: number): string {
  if (key === "del") return text.slice(0, -1);
  const [whole = "", frac] = text.split(".");
  if (key === ".") return frac !== undefined || decimals === 0 ? text : `${whole === "" ? "0" : whole}.`;
  if (frac !== undefined) return frac.length >= Math.min(decimals, TYPED_DECIMALS_MAX) ? text : `${text}${key}`;
  if (whole === "0") return key;
  return whole.length >= TYPED_WHOLE_MAX ? text : `${text}${key}`;
}

export function TokenTicket({ symbol, side }: { symbol: string; side: TradeSide }) {
  const token = spotToken(symbol);
  if (!token) {
    return (
      <TransactionSheet onClose={() => router.back()} closeLabel="Close the swap ticket">
        <QuietLine>{symbol} has no live Uniswap pool on Monad</QuietLine>
      </TransactionSheet>
    );
  }
  return <Ticket token={token} initialSide={side} />;
}

function Ticket({ token, initialSide }: { token: SpotToken; initialSide: TradeSide }) {
  const { color } = useTheme();
  const t = useTokenTrade(token, initialSide);
  const outcome = useSettledOutcome(t.trace.events);
  const inFlight = t.trace.events.length > 0 || t.trace.running;
  const usdcMark = collateralId(MAINNET_CHAIN_ID, "USDC");
  const inMark = t.side === "buy" ? usdcMark : token.mark;
  const outMark = t.side === "buy" ? token.mark : usdcMark;
  const verb = t.side === "buy" ? "Buy" : "Sell";
  const insets = useSafeAreaInsets();
  return (
    <TransactionSheet
      onClose={() => {
        // A swap still unknown stays on the ticket (its trace is kept by key): reopening shows it, never a new draft.
        if (!t.trace.running && outcome !== "unknown") t.reset();
        router.back();
      }}
      closeLabel="Close the swap ticket"
      locked={t.trace.running}
      header={
        <View style={styles.header}>
          <View style={styles.identity}>
            <EntityMark id={token.mark} size={SIZE.markDetail} decorative />
            <View>
              <Text style={[TYPE.rowTitle, { color: color.ink }]}>
                {verb} {token.symbol}
              </Text>
              <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Monad mainnet · real money</Text>
            </View>
          </View>
          {inFlight ? null : (
            <Segmented label="Buy or sell" options={SIDES} value={t.side} onChange={(v) => t.setSide(v)} />
          )}
        </View>
      }
    >
      {inFlight ? (
        <View style={[styles.body, styles.stack]}>
          {t.step && t.step.count > 1 ? (
            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
              Send {t.step.index + 1} of {t.step.count}
              {t.step.index + 1 < t.step.count ? " · approving the swap's input" : " · the swap"}
            </Text>
          ) : null}
          {t.executed ? (
            <Panel style={styles.rows}>
              <KeyValue label="Reviewed payment" value={t.executed.paid} />
              <KeyValue label="Receive (estimated)" value={t.executed.quoted} />
              <KeyValue label="At least" value={t.executed.atLeast} />
            </Panel>
          ) : null}
          <OperationSummary record={t.trace.record} />
          <TradeTrace
            words={{
              ...SWAP_WORDS,
              ...(t.trace.record?.steps.some((s) => s.outcome === "completed") && outcome !== "finalized"
                ? { reverted: "A later swap step reverted. Earlier completed approvals remain in place." }
                : {}),
            }}
            record={t.trace.record}
            events={t.trace.events}
            running={t.trace.running}
            outcome={outcome}
            onDone={t.reset}
            onLeave={() => router.back()}
          />
        </View>
      ) : (
        <>
          <View style={styles.body}>
            <View>
              <SwapSide
                label="You pay"
                mark={inMark}
                symbol={t.inSymbol}
                amount={t.text === "" ? "0" : t.text}
                note={
                  t.inBalance === undefined
                    ? "Reading your balance"
                    : `You hold ${tokenAmount(t.inBalance, t.inDecimals)}`
                }
              />
              <SwapFlip onPress={() => t.setSide(t.side === "buy" ? "sell" : "buy")} />
              <SwapSide
                label="You receive ≈"
                mark={outMark}
                symbol={t.outSymbol}
                amount={t.q ? tokenAmount(t.q.amountOut, t.outDecimals) : "—"}
                note={
                  t.outBalance === undefined
                    ? "Reading your balance"
                    : `You hold ${tokenAmount(t.outBalance, t.outDecimals)}`
                }
              />
            </View>
            <View style={styles.presets}>
              {COLLATERAL_STEPS_BPS.map((b) => {
                const label = b >= RISK.BPS ? (t.side === "sell" ? "Sell all" : "Max") : pct(b);
                return (
                  <Preset
                    key={String(b)}
                    label={label}
                    accessibilityLabel={`${label} of your ${t.inSymbol}`}
                    disabled={!t.inBalance}
                    onPress={() => t.setShare(b, RISK.BPS)}
                  />
                );
              })}
            </View>
            <View style={styles.quote}>
              <Text numberOfLines={2} style={[TYPE.rowDetail, styles.shrink, { color: color.text2 }]}>
                {t.q
                  ? `Impact ${finePct(t.q.priceImpactBps)} · fees ${finePct(t.q.feeBps)} · at least ${tokenAmount(t.q.minOut, t.outDecimals, t.outSymbol)}`
                  : `${finePct(SPOT_SLIPPAGE_BPS)} slippage · the quote refreshes every few seconds`}
              </Text>
              <View style={styles.venue}>
                <EntityMark id={ids.provider("uniswap")} size={SIZE.markInline} decorative variant="symbol" />
                <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Uniswap v4</Text>
              </View>
            </View>
            <View style={styles.region}>
              <Keypad onKey={(key) => t.setText(applyTokenKey(t.text, key, t.inDecimals))} />
            </View>
          </View>
          <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.sm }]}>
            <HoldToConfirm
              resetKey={[t.side, t.amountIn, t.q?.minOut, token.address].join(":")}
              label={actionLabel(t.block, verb, token.symbol, t.inSymbol, t.gasShortWei, t.quote.status)}
              disabled={t.block !== undefined && t.block !== "short-gas"}
              onConfirm={() => void t.submit()}
            />
          </View>
        </>
      )}
    </TransactionSheet>
  );
}

/** What the primary action says: the next thing to do, or the trade itself. */
function actionLabel(
  block: TradeBlock | undefined,
  verb: string,
  symbol: string,
  inSymbol: string,
  gasShortWei: bigint | undefined,
  quoteStatus: string,
): string {
  switch (block) {
    case "practice":
      return "Spot tokens trade on Mainnet";
    case "no-account":
      return "Create an account to trade";
    case "empty":
      return "Enter an amount";
    case "short-input":
      return `Not enough ${inSymbol}`;
    case "no-quote":
      return quoteStatus === "failed" ? "No quote right now" : "Getting a quote…";
    case "short-gas":
      return `Add ${tokenAmount(gasShortWei ?? 0n, MON_DECIMALS)} MON for gas`;
    case undefined:
      return `${verb} ${symbol}`;
  }
}

const styles = StyleSheet.create({
  // The order ticket's geometry (Ticket/TicketHeader): the gutter on header and body, the keypad filling what's left.
  header: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.xs },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  body: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.sm },
  stack: { gap: SPACE.lg },
  quote: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  shrink: { flex: 1 },
  venue: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  presets: { flexDirection: "row", gap: SPACE.sm },
  region: { flex: 1, justifyContent: "flex-end" },
  footer: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
