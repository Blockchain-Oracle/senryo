import { useEffect, useRef, useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { activeNetwork } from "~/lib/network";
import type { MoneyAsset } from "./assets";
import { openRampBuy, rampAssetOf, recordRampReturn } from "./ramp";

/** Snapshot the balance before opening the native provider and recheck account/mode before recording its result. */
export function useRampBuy(chainId: number) {
  const account = useAccount();
  const current = useRef(account.hint?.address);
  current.current = account.hint?.address;
  const [opening, setOpening] = useState<string>();
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const buy = async (asset: Pick<MoneyAsset, "key" | "symbol" | "wallet">) => {
    const owner = current.current;
    if (!owner || busy.current || activeNetwork().chainId !== chainId) return false;
    busy.current = true;
    setOpening(asset.key);
    try {
      const result = await openRampBuy(owner, rampAssetOf(chainId, asset.key));
      const isCurrent = () => alive.current && current.current?.toLowerCase() === owner.toLowerCase();
      recordRampReturn(result, chainId, owner, asset, isCurrent);
      return result.kind === "created" && isCurrent() && activeNetwork().chainId === chainId;
    } finally {
      busy.current = false;
      setOpening(undefined);
    }
  };
  return { buy, opening };
}
