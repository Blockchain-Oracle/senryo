/**
 * Card or bank through Ramp (B5/B10, routes.md §6, plan D5). Buy: Ramp's hosted page in the in-app browser with the
 * wallet as `userAddress`, the app as `finalUrl`, `enabledFlows=ONRAMP` and the Monad assets Ramp lists (`MONAD_MON`,
 * `MONAD_USDC`, `MONAD_AUSD`, `MONAD_USDT0`; `outAsset` preselects one — `defaultAsset`/`swapAsset` are deprecated).
 * No key is needed to buy. A return through `finalUrl` is the only signal (keyless status is UNDEFINED-5), so arrival
 * is detected from the holdings. Sell needs a support-issued `hostApiKey` with off-ramp; until one is configured the
 * Bank tab says so and offers no dead button.
 */
import { MAINNET_CHAIN_ID, MAINNET_TOKENS, NATIVE_TOKEN, WEB_ORIGIN } from "@senryo/config";
import { APP } from "~/lib/constants/app";
import { webBrowserModule } from "./native";

const RAMP_HOSTED = "https://app.rampnetwork.com/";
const RAMP_RETURN = `${APP.scheme}://ramp-return`;

/** Ramp's Monad asset ids by token address (mainnet only). */
const RAMP_BY_ADDRESS: Readonly<Record<string, string>> = {
  [NATIVE_TOKEN.toLowerCase()]: "MONAD_MON",
  [MAINNET_TOKENS.usdc.toLowerCase()]: "MONAD_USDC",
  [MAINNET_TOKENS.ausd.toLowerCase()]: "MONAD_AUSD",
  [MAINNET_TOKENS.usdt0.toLowerCase()]: "MONAD_USDT0",
};
export const RAMP_ASSETS = Object.values(RAMP_BY_ADDRESS);

/** Off-ramp needs a Ramp `hostApiKey` with sell enabled (issued by Ramp support, not self-serve). */
export const RAMP_SELL_READY = false;

export function rampAssetOf(chainId: number, address: string): string | undefined {
  return chainId === MAINNET_CHAIN_ID ? RAMP_BY_ADDRESS[address.toLowerCase()] : undefined;
}

export function rampBuyUrl(userAddress: string, outAsset?: string): string {
  const params = new URLSearchParams({
    hostAppName: "Senryo",
    hostLogoUrl: `${WEB_ORIGIN}/apple-touch-icon.png`,
    userAddress,
    finalUrl: RAMP_RETURN,
    enabledFlows: "ONRAMP",
    defaultFlow: "ONRAMP",
    enabledCryptoAssets: RAMP_ASSETS.join(","),
    ...(outAsset ? { outAsset } : {}),
  });
  return `${RAMP_HOSTED}?${params.toString()}`;
}

export type RampResult = "returned" | "closed" | "unavailable";

/** Opens Ramp's hosted buy page; resolves `returned` only when Ramp sent the user back through `finalUrl`. */
export async function openRampBuy(userAddress: string, outAsset?: string): Promise<RampResult> {
  const browser = webBrowserModule();
  if (!browser) return "unavailable";
  const result = await browser.openAuthSessionAsync(rampBuyUrl(userAddress, outAsset), RAMP_RETURN);
  return result.type === "success" ? "returned" : "closed";
}
