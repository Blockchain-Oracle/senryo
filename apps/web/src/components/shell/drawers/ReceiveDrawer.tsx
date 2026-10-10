"use client";
/**
 * Receive (`?d=receive`; the phone's `ReceiveCard`): this account's Monad address as a dotted QR and in full, one tap
 * to copy, and which money it takes on this network.
 */
import { shortAddress } from "@senryo/core";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { DottedQr } from "@/components/kit/dotted-qr";
import { CopyCode } from "@/components/ui/copy-code-button";
import { SlideOver } from "@/components/ui/drawer";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import type { DrawerProps } from "./types";

export function ReceiveDrawer({ open, onOpenChange }: DrawerProps) {
  const address = useAccount().hint?.address;
  const practice = ACTIVE_NETWORK.key === "testnet";
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Receive"
      description={practice ? "Test dollars on Monad's test network" : "USDC on Monad"}
    >
      {address ? (
        <div className="flex flex-col items-center gap-5 pt-2">
          <div className="w-full max-w-64 rounded-xl bg-qr-paper p-4">
            <DottedQr value={address} label={`Your address ${shortAddress(address)}`} />
          </div>
          <p className="break-all text-center font-semibold text-row tnum">{address}</p>
          <CopyCode code={address} display={shortAddress(address)} copiedLabel="Address copied" />
          <p className="text-center text-meta text-text-3">
            {practice ? "Only test dollars on Monad testnet. Nothing here has value." : "Only USDC on Monad."}
          </p>
        </div>
      ) : (
        <SignInPrompt line="Sign in to see your address." className="pt-2" />
      )}
    </SlideOver>
  );
}
