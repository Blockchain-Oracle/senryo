/**
 * Practice money (B15): the one-time claim (StarterDrip — MON for fees plus practice AUSD credited to the account) and
 * the daily top-up (MockAUSD `faucet()` — practice AUSD minted to the wallet once a day), read from the chain: the
 * claim's practice amount from `StarterDrip.config()`, the faucet's amount and next time from MockAUSD. Both land in
 * the one AUSD row of Assets (the trading part folds in), so the user never sees where it sits (BD-3). The faucet is a
 * session-scope send journalled like any other money operation.
 */
import { isDeployed, readContract } from "@senryo/chain";
import { keys, practiceFaucetRequest, traceOutcome, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useMoneyOperation } from "~/features/money/useMoneyOperation";
import { useAccount } from "~/lib/account/provider";
import { useStarter } from "~/lib/account/use-starter";

const MS_PER_SECOND = 1000n;
const PRACTICE_AMOUNT_INDEX = 4;
const PRACTICE_READ_STALE_MS = 60_000;

export function usePracticeMoney() {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const starter = useStarter();
  const faucetReady = isDeployed(env.chainId, "MockAUSD");
  const reads = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "practice-money"] as const,
    enabled: address !== undefined && faucetReady,
    staleTime: PRACTICE_READ_STALE_MS,
    queryFn: async () => {
      const ausd = readContract(env.chainId, "MockAUSD", env.read);
      const drip = isDeployed(env.chainId, "StarterDrip")
        ? readContract(env.chainId, "StarterDrip", env.read)
        : undefined;
      const [faucetAmount, nextAt, config] = await Promise.all([
        ausd.read.FAUCET_AMOUNT(),
        ausd.read.nextFaucetAt([address ?? "0x"]),
        drip ? drip.read.config() : Promise.resolve(undefined),
      ]);
      return {
        faucetAmount,
        /** Unix seconds; 0 = never used. */
        nextAt: BigInt(nextAt),
        claimAmount: config ? (config[PRACTICE_AMOUNT_INDEX] as bigint) : undefined,
      };
    },
  });
  const faucet = useMoneyOperation(`practice-faucet:${env.chainId}:${address ?? "guest"}`);
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const value = reads.data;
  const waitSec = value && value.nextAt > nowSec ? value.nextAt - nowSec : 0n;
  const outcome = traceOutcome(faucet.trace.events);
  const topUp = () => {
    if (!address || !value || faucet.trace.running) return;
    faucet.reset();
    void faucet.run({
      steps: [{ action: "faucet", label: "Daily top-up", request: practiceFaucetRequest(env.chainId) }],
      reviewedIntent: {
        kind: "faucet",
        symbol: "AUSD",
        amount: value.faucetAmount.toString(),
        recipient: address,
        destination: "wallet",
      },
      revalidate: async () => undefined,
    });
  };
  return {
    starter,
    faucetAvailable: faucetReady,
    faucetAmount: value?.faucetAmount,
    claimAmount: value?.claimAmount,
    waitSec,
    faucetRunning: faucet.trace.running,
    faucetOutcome: outcome,
    faucetEvents: faucet.trace.events,
    topUp,
  };
}
