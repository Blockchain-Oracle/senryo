"use client";

/**
 * Who money goes to, checked before review and again before broadcast (B7 rules, B13): an EIP-55 checksum (a mixed-case
 * address that doesn't match is a typo), a Senryo deposit inbox (blocked — it only sweeps AUSD/USDC into an account
 * and would strand anything else), your own address (Send → Withdraw), a contract (warned), and a first send to this
 * address (warned). A 7702-delegated wallet carries a delegation designator, not contract code, and is a wallet.
 */
import { addressOf, getAddress, isDeployed, type ReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { operationsFor, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";

const HEX_BODY = 2;
/** EIP-7702 delegation designator prefix: `0xef0100 ‖ delegate`. */
const DELEGATION_PREFIX = "0xef0100";
const RECIPIENT_CHECK_STALE_MS = 30_000;

const inboxUserAbi = [
  { type: "function", name: "USER", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;
const inboxOfAbi = [
  {
    type: "function",
    name: "inboxOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/** A typed address whose letters are mixed case must match its checksum; all-lower / all-upper carry none. */
export function checksumOk(address: string): boolean {
  const body = address.slice(HEX_BODY);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  try {
    return getAddress(address) === address;
  } catch {
    return false;
  }
}

export type RecipientBlock = "typo" | "inbox" | "self";
export type RecipientWarning = "contract" | "first";

export interface RecipientCheck {
  block: RecipientBlock | undefined;
  warnings: RecipientWarning[];
}

export const RECIPIENT_WORDS: Record<RecipientBlock | RecipientWarning, string> = {
  typo: "Address typo · check it",
  inbox: "Deposit inbox · not a wallet",
  self: "That's you · use Withdraw",
  contract: "This is a contract",
  first: "First send to this address",
};

async function isSenryoInbox(read: ReadClient, chainId: ChainId, address: `0x${string}`): Promise<boolean> {
  if (!isDeployed(chainId, "InboxFactory")) return false;
  try {
    const user = await read.readContract({ address, abi: inboxUserAbi, functionName: "USER" });
    const inbox = await read.readContract({
      address: addressOf(chainId, "InboxFactory"),
      abi: inboxOfAbi,
      functionName: "inboxOf",
      args: [user],
    });
    return inbox.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/** Every check that reads the chain; `known` = addresses this account already sent to (journal + indexer). */
export async function checkRecipient(
  read: ReadClient,
  chainId: ChainId,
  me: string,
  address: `0x${string}`,
  known: ReadonlySet<string>,
): Promise<RecipientCheck> {
  if (!checksumOk(address)) return { block: "typo", warnings: [] };
  if (address.toLowerCase() === me.toLowerCase()) return { block: "self", warnings: [] };
  const code = await read.getCode({ address });
  const contract = code !== undefined && code !== "0x" && !code.toLowerCase().startsWith(DELEGATION_PREFIX);
  if (contract && (await isSenryoInbox(read, chainId, address))) return { block: "inbox", warnings: [] };
  const warnings: RecipientWarning[] = [];
  if (contract) warnings.push("contract");
  if (!known.has(address.toLowerCase())) warnings.push("first");
  return { block: undefined, warnings };
}

/** Addresses this account sent money to from this phone (any asset), newest first. */
export function journalRecipients(chainId: number, me: string): string[] {
  const seen = new Set<string>();
  for (const record of operationsFor(chainId, me)) {
    const to = record.reviewedIntent.recipient?.toLowerCase();
    if (to && to !== me.toLowerCase() && record.outcome === "completed") seen.add(to);
  }
  return [...seen];
}

/** The chain checks for one resolved address (cached briefly; the send re-runs them before signing). */
export function useRecipientCheck(
  me: string | undefined,
  address: `0x${string}` | undefined,
  known: ReadonlySet<string>,
) {
  const env = useQueryEnv();
  return useQuery({
    queryKey: ["recipient-check", env.chainId, me?.toLowerCase() ?? "", address?.toLowerCase() ?? "", known.size],
    queryFn: () => checkRecipient(env.read, env.chainId, me ?? "", address as `0x${string}`, known),
    enabled: me !== undefined && address !== undefined,
    staleTime: RECIPIENT_CHECK_STALE_MS,
  });
}
