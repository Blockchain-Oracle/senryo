/**
 * A spot token buy or sell (J11) from the account's own Monad wallet through Uniswap v4: the typed amount in the
 * input's units (USDC on a buy, the token on a sell), what the account holds of each, a live quote, the gas the swap
 * needs in MON, and the send. A router call is outside the trading session's scope (the policy decodes it as
 * unknown), so every spot trade runs behind a step-up — one fresh passkey check signs its approvals and the swap —
 * and each send is traced to finalized. Mainnet only: the pools don't exist on the test network.
 */
import { sellableNative } from "@senryo/chain";
import { SPOT_TOKENS, type SpotToken } from "@senryo/config";
import { parseUnits } from "@senryo/core";
import {
  gasBudgetFor,
  mainnetReadOf,
  tokenSwapRequests,
  useQueryEnv,
  useSendTrace,
  useTokenHoldings,
  useTokenQuote,
  useWalletUsdc,
} from "@senryo/query";
import { useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { useNetwork } from "~/lib/network";
import { tokenAmount } from "./format";

export type TradeSide = "buy" | "sell";
/** Why the ticket can't send yet, in the order it is checked. */
export type TradeBlock = "practice" | "no-account" | "empty" | "short-input" | "no-quote" | "short-gas";

const USDC_DECIMALS = 6;
const USDC_SYMBOL = "USDC";
const MON = SPOT_TOKENS.find((t) => t.native);

export function useTokenTrade(token: SpotToken, initialSide: TradeSide) {
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const address = account.hint?.address;
  const trace = useSendTrace(`spot:${token.symbol}`);
  const [side, setSide] = useState<TradeSide>(initialSide);
  const [text, setText] = useState("");
  const [gasShortWei, setGasShortWei] = useState<bigint>();
  const [step, setStep] = useState<{ index: number; count: number }>();
  /** The swap as it went to the passkey check — frozen, so a refreshed quote never changes the receipt. */
  const [executed, setExecuted] = useState<{ paid: string; atLeast: string; quoted: string }>();

  const inDecimals = side === "buy" ? USDC_DECIMALS : token.decimals;
  const parsed = parseUnits(text === "" ? "0" : text, inDecimals);
  const amountIn = parsed.ok ? parsed.value : 0n;

  const holdings = useTokenHoldings(address, MON && !token.native ? [token, MON] : [token]);
  const held = holdings.status === "fresh" || holdings.status === "stale" ? holdings.value : undefined;
  const tokenBalance = held?.find((h) => h.token.symbol === token.symbol)?.balance;
  const monBalance = held?.find((h) => h.token.native)?.balance;
  const usdcReading = useWalletUsdc(address);
  const usdc = usdcReading.status === "fresh" || usdcReading.status === "stale" ? usdcReading.value : undefined;
  // A MON sell keeps Monad's 10 MON sender reserve (gas is checked at submit).
  const sellable = token.native && tokenBalance !== undefined ? sellableNative(tokenBalance, 0n) : tokenBalance;
  const inBalance = side === "buy" ? usdc : sellable;
  const quote = useTokenQuote(token, side, amountIn);
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;

  const block: TradeBlock | undefined =
    network.key === "testnet"
      ? "practice"
      : !address || !account.client
        ? "no-account"
        : amountIn === 0n
          ? "empty"
          : inBalance !== undefined && amountIn > inBalance
            ? "short-input"
            : !q
              ? "no-quote"
              : gasShortWei !== undefined
                ? "short-gas"
                : undefined;

  const inSymbol = side === "buy" ? USDC_SYMBOL : token.symbol;
  const outSymbol = side === "buy" ? token.symbol : USDC_SYMBOL;
  const outDecimals = side === "buy" ? token.decimals : USDC_DECIMALS;

  /** Sets the amount to a share (bps) of what the account holds of the input. */
  const setShare = (bps: bigint, totalBps: bigint) => {
    if (inBalance === undefined) return;
    const amount = (inBalance * bps) / totalBps;
    setText(tokenAmount(amount, inDecimals).replace(/,/g, ""));
  };

  const submit = async () => {
    const client = account.client;
    if (!q || !address || !client || block) return;
    const requests = await tokenSwapRequests(env, address, q);
    // Gas is the account's own MON on mainnet (no drip there): check every send's budget before asking for a passkey.
    const budgets = await Promise.all(requests.map((r) => gasBudgetFor(mainnetReadOf(env), address, r)));
    const needWei = budgets.reduce((sum, b) => sum + b.needWei, 0n);
    const valueWei = requests.reduce((sum, r) => sum + (r.value ?? 0n), 0n);
    const monWei = monBalance ?? 0n;
    if (monWei < needWei + valueWei) {
      setGasShortWei(needWei + valueWei - monWei);
      return;
    }
    setGasShortWei(undefined);
    const outText = tokenAmount(q.amountOut, outDecimals, outSymbol);
    await requestStepUp(
      {
        title: side === "buy" ? `Buy ${token.symbol}` : `Sell ${token.symbol}`,
        detail: `Swap ${text} ${inSymbol} for about ${outText} through Uniswap v4 on Monad — real money, at least ${tokenAmount(q.minOut, outDecimals, outSymbol)}. Trades from your account always ask for a fresh passkey check.`,
        confirmLabel: side === "buy" ? "Buy with passkey" : "Sell with passkey",
      },
      () =>
        account.stepUp(async (signer) => {
          setExecuted({
            paid: `${text} ${inSymbol}`,
            quoted: outText,
            atLeast: tokenAmount(q.minOut, outDecimals, outSymbol),
          });
          const sender = stepUpSender(signer);
          for (const [index, request] of requests.entries()) {
            setStep({ index, count: requests.length });
            const result = await trace.run(sender, request);
            if (result?.final?.stage !== "finalized") return result;
          }
          return undefined;
        }),
    );
  };

  return {
    side,
    setSide: (s: TradeSide) => {
      setSide(s);
      setText("");
      setGasShortWei(undefined);
    },
    text,
    setText,
    amountIn,
    inSymbol,
    outSymbol,
    inDecimals,
    outDecimals,
    inBalance,
    outBalance: side === "buy" ? tokenBalance : usdc,
    quote,
    q,
    block,
    gasShortWei,
    step,
    executed,
    trace,
    setShare,
    submit,
    reset: () => {
      trace.reset();
      setStep(undefined);
      setExecuted(undefined);
      setText("");
    },
  };
}
