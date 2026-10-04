/** Ramp's official native SDK. Purchase creation is not proof of payment or arrival. */
import type RampSdk from "@ramp-network/react-native-sdk";
import type { RampPurchase } from "@ramp-network/react-native-sdk";
import { MAINNET_CHAIN_ID, MAINNET_TOKENS, NATIVE_TOKEN, WEB_ORIGIN } from "@senryo/config";
import { NativeModules } from "react-native";
import { APP } from "~/lib/constants/app";
import { activeNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { recordArrival } from "./arrivals";
import type { MoneyAsset } from "./assets";

const RAMP_BY_ADDRESS: Readonly<Record<string, string>> = {
  [NATIVE_TOKEN.toLowerCase()]: "MONAD_MON",
  [MAINNET_TOKENS.usdc.toLowerCase()]: "MONAD_USDC",
  [MAINNET_TOKENS.ausd.toLowerCase()]: "MONAD_AUSD",
  [MAINNET_TOKENS.usdt0.toLowerCase()]: "MONAD_USDT0",
};
export const RAMP_ASSETS = Object.values(RAMP_BY_ADDRESS);
export const RAMP_SELL_READY = false;
const PAID_STATES = new Set(["PAYMENT_EXECUTED", "FIAT_RECEIVED", "RELEASING", "RELEASED"]);
let sdk: RampSdk | undefined;
let opening = false;

export function rampAssetOf(chainId: number, address: string): string | undefined {
  return chainId === MAINNET_CHAIN_ID ? RAMP_BY_ADDRESS[address.toLowerCase()] : undefined;
}

export type RampResult =
  | { kind: "created"; purchase: Pick<RampPurchase, "id" | "status" | "asset" | "cryptoAmount" | "receiverAddress"> }
  | { kind: "closed" | "unavailable" | "failed" };

/** Singleton: the SDK attaches native listeners at construction and has no native-listener disposal API. */
export async function openRampBuy(userAddress: string, outAsset?: string): Promise<RampResult> {
  if (!NativeModules.RampSdk) return { kind: "unavailable" };
  if (opening || activeNetwork().chainId !== MAINNET_CHAIN_ID || !outAsset || !RAMP_ASSETS.includes(outAsset))
    return { kind: "closed" };
  try {
    sdk ??= new (require("@ramp-network/react-native-sdk").default)();
  } catch {
    return { kind: "failed" };
  }
  const ramp = sdk;
  if (!ramp) return { kind: "unavailable" };
  opening = true;
  return new Promise((resolve) => {
    let purchase: RampPurchase | undefined;
    let settled = false;
    const finish = (result: RampResult) => {
      if (settled) return;
      settled = true;
      ramp.unsubscribe("*", listener);
      opening = false;
      resolve(result);
    };
    const listener: Parameters<RampSdk["unsubscribe"]>[1] = (event) => {
      if (event.type === "PURCHASE_CREATED") {
        const value = event.payload?.purchase;
        // Provider events cross a native boundary; malformed events must not strand the close listener.
        if (
          !value?.asset ||
          typeof value.id !== "string" ||
          typeof value.status !== "string" ||
          typeof value.cryptoAmount !== "string" ||
          !/^\d+$/.test(value.cryptoAmount) ||
          typeof value.receiverAddress !== "string" ||
          (value.asset.address != null && typeof value.asset.address !== "string")
        )
          return;
        // The native SDK constrains the asset with swapAsset. Verify its network, receiver and actual address too.
        const wanted = Object.entries(RAMP_BY_ADDRESS).find(([, id]) => id === outAsset)?.[0];
        const identity = value.asset as RampPurchase["asset"] & { chain?: string; apiV3Symbol?: string };
        const address = value.asset?.address?.toLowerCase() ?? NATIVE_TOKEN.toLowerCase();
        if (
          value.receiverAddress?.toLowerCase() === userAddress.toLowerCase() &&
          address === wanted &&
          (identity.chain === "MONAD" ||
            identity.apiV3Symbol === outAsset ||
            value.asset.symbol === outAsset ||
            (typeof value.asset.type === "string" && value.asset.type.startsWith("MONAD")) ||
            (typeof value.asset.symbol === "string" && value.asset.symbol.startsWith("MONAD_")))
        )
          purchase = value;
      }
      if (event.type === "WIDGET_CLOSE")
        finish(
          event.payload?.error
            ? { kind: "failed" }
            : purchase
              ? {
                  kind: "created",
                  purchase: {
                    id: purchase.id,
                    status: purchase.status,
                    asset: purchase.asset,
                    cryptoAmount: purchase.cryptoAmount,
                    receiverAddress: purchase.receiverAddress,
                  },
                }
              : { kind: "closed" },
        );
    };
    ramp.on("*", listener);
    try {
      ramp.show({
        url: "https://app.rampnetwork.com",
        hostAppName: APP.name,
        hostLogoUrl: `${WEB_ORIGIN}/apple-touch-icon.png`,
        userAddress,
        // RN 1.0.3's native bridge forwards swapAsset; it doesn't forward the web SDK's outAsset parameter.
        swapAsset: outAsset,
        enabledFlows: ["ONRAMP"],
        defaultFlow: "ONRAMP",
        deepLinkScheme: APP.scheme,
      });
    } catch {
      finish({ kind: "failed" });
    }
  });
}

export function recordRampReturn(
  result: RampResult,
  chainId: number,
  owner: string,
  asset: Pick<MoneyAsset, "key" | "symbol" | "wallet">,
  isCurrent: () => boolean,
): void {
  if (result.kind === "unavailable" || result.kind === "failed") {
    notify({ title: result.kind === "unavailable" ? "Update the app to buy" : "Couldn’t open Ramp", tone: "warning" });
    return;
  }
  if (result.kind !== "created") return;
  if (activeNetwork().chainId !== chainId || !isCurrent()) return;
  if (!PAID_STATES.has(result.purchase.status)) {
    notify({ title: "Purchase started", description: "Payment and delivery are still handled by Ramp" });
    return;
  }
  recordArrival({
    kind: "ramp",
    chainId,
    account: owner.toLowerCase(),
    asset: asset.key,
    symbol: asset.symbol,
    baseline: asset.wallet.toString(),
    amount: result.purchase.cryptoAmount,
    via: "Ramp",
  });
  notify({ title: "Checking delivery", description: `${asset.symbol} · Ramp` });
}
