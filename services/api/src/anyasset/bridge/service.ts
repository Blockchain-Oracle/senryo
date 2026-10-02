/**
 * `/v1/bridge/{routes,quote,status}` (B4/B9, D2) over the route table in `@senryo/config` (`BRIDGE_ROUTES`). A quote
 * asks every provider the route lists in parallel and returns the best minimum received; a provider whose Monad step
 * calls or approves anything outside `BRIDGE_CONTRACTS` is dropped (kept as an alternative with the reason). Steps on
 * the other chain (inbound) are returned for the sender's own wallet there; only Monad steps are pinned.
 */
import type {
  BridgeAlternative,
  BridgeDepositAddressResponse,
  BridgeDepositStatus,
  BridgeQuoteResponse,
  BridgeRoutes,
  BridgeStatus,
  BridgeStepWire,
} from "@senryo/api-client";
import type { Address } from "@senryo/chain";
import {
  BRIDGE_TYPICAL_ETA_SEC,
  type BridgeAsset,
  type BridgeDirection,
  type BridgeProvider,
  bridgeChain,
  bridgeRoute,
  bridgeRoutesFor,
  type ChainId,
  isChainId,
  isPinnedBridgeTarget,
  MAINNET_CHAIN_ID,
  MONAD_BRIDGE_ASSETS,
  type RemoteAsset,
  type VmType,
} from "@senryo/config";
import { HTTP_STATUS, HttpError, type Logger } from "@senryo/service-common";
import { errorText, settleAll } from "../upstream.ts";
import { acrossQuote, acrossStatus } from "./across.ts";
import type { AuroraWatcher } from "./aurora.ts";
import { cctpQuote, cctpStatus } from "./cctp.ts";
import { relayDepositAddress, relayDeposits } from "./deposit-address.ts";
import { lifiQuote, lifiStatus } from "./lifi.ts";
import { relayQuote, relayStatus } from "./relay.ts";
import type { ProviderQuote, QuoteContext, StatusInput, StatusResult } from "./types.ts";

type Served = Exclude<BridgeProvider, "aurora">;
const QUOTERS: Record<Served, (ctx: QuoteContext) => Promise<ProviderQuote>> = {
  relay: relayQuote,
  cctp: cctpQuote,
  across: acrossQuote,
  lifi: lifiQuote,
};
const STATUS: Record<Served, (input: StatusInput) => Promise<StatusResult>> = {
  relay: relayStatus,
  cctp: cctpStatus,
  across: acrossStatus,
  lifi: lifiStatus,
};

const RECIPIENT: Record<VmType, RegExp> = {
  evm: /^0x[0-9a-fA-F]{40}$/,
  svm: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tvm: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
};
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export interface BridgeQuoteInput {
  fromChain: number;
  toChain: number;
  asset: BridgeAsset;
  amount: bigint;
  sender: Address;
  recipient: string;
  remote?: RemoteAsset | undefined;
  provider?: BridgeProvider | undefined;
}

export interface DepositAddressInput {
  fromChain: number;
  toChain: ChainId;
  asset: BridgeAsset;
  remote?: RemoteAsset | undefined;
  amount: bigint;
  recipient: Address;
}

const bad = (message: string) => new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", message);

/** Why a provider's steps can't be signed as given, or null. Monad steps must target pinned contracts only. */
function stepRefusal(monad: ChainId, monadToken: string, steps: readonly BridgeStepWire[]): string | null {
  for (const step of steps) {
    if (step.chainId !== monad) continue;
    if (step.kind === "approve") {
      if (step.token.toLowerCase() !== monadToken.toLowerCase()) return `approval of an unexpected token ${step.token}`;
      if (!isPinnedBridgeTarget(monad, step.spender)) return `approval spender ${step.spender} is not pinned`;
    } else if (!isPinnedBridgeTarget(monad, step.to)) return `call target ${step.to} is not pinned`;
  }
  return null;
}

export class BridgeService {
  constructor(
    private readonly log: Logger,
    private readonly aurora: AuroraWatcher,
    private readonly relayKey?: string | undefined,
  ) {}

  async routes(chainId: ChainId, asset: BridgeAsset, direction: BridgeDirection): Promise<BridgeRoutes> {
    const chains = bridgeRoutesFor(chainId, asset, direction).flatMap((route) => {
      const chain = bridgeChain(route.chain);
      if (!chain) return [];
      const remote = route.remote.flatMap((a) => {
        const token = chain.tokens[a];
        return token ? [{ asset: a, ...token }] : [];
      });
      const providers = route.providers.map((provider) => ({ provider, available: true, reason: null }));
      const etaSec = Math.min(...route.providers.map((p) => BRIDGE_TYPICAL_ETA_SEC[p]));
      return [
        {
          chainId: chain.id,
          name: chain.name,
          vm: chain.vm,
          mark: chain.mark,
          remote,
          providers,
          available: true,
          etaSec,
        },
      ];
    });
    return { chainId, asset, direction, chains, aurora: await this.aurora.state() };
  }

  async quote(input: BridgeQuoteInput): Promise<BridgeQuoteResponse> {
    const at = new Date().toISOString();
    const base = { at, fromChain: input.fromChain, toChain: input.toChain, asset: input.asset };
    const fromMonad = isChainId(input.fromChain);
    const toMonad = isChainId(input.toChain);
    if (fromMonad === toMonad) throw bad("exactly one of fromChain / toChain must be a Monad network");
    const monad = (fromMonad ? input.fromChain : input.toChain) as ChainId;
    const direction: BridgeDirection = fromMonad ? "out" : "in";
    const remoteId = fromMonad ? input.toChain : input.fromChain;
    const route = bridgeRoute(monad, input.asset, direction, remoteId);
    const chain = bridgeChain(remoteId);
    const unsupported = (reason: string): BridgeQuoteResponse => ({
      status: "unsupported",
      ...base,
      reason,
      alternatives: [],
    });
    if (!route || !chain)
      return unsupported(`No route for ${input.asset} ${direction === "out" ? "to" : "from"} this chain`);
    const remoteAsset = input.remote ?? route.remote[0];
    if (!remoteAsset || !route.remote.includes(remoteAsset)) return unsupported(`${input.remote} is not served here`);
    const remoteToken = chain.tokens[remoteAsset];
    const monadToken = MONAD_BRIDGE_ASSETS[monad][input.asset];
    if (!remoteToken || !monadToken) return unsupported("asset not listed on this chain");
    const recipientVm: VmType = fromMonad ? chain.vm : "evm";
    if (!RECIPIENT[recipientVm].test(input.recipient)) throw bad(`recipient is not a valid ${recipientVm} address`);
    if (input.amount <= 0n) throw bad("amount must be positive");
    const providers = route.providers.filter(
      (p): p is Served => p !== "aurora" && (!input.provider || p === input.provider),
    );
    if (providers.length === 0) return unsupported(`${input.provider} does not serve this route`);

    const monadSide = { chainId: monad, token: monadToken };
    const remoteSide = { chainId: remoteId, token: remoteToken };
    const ctx: QuoteContext = {
      monadChainId: monad,
      direction,
      asset: input.asset,
      remoteAsset,
      remoteChain: chain,
      from: fromMonad ? monadSide : remoteSide,
      to: fromMonad ? remoteSide : monadSide,
      amount: input.amount,
      sender: input.sender,
      recipient: input.recipient,
    };
    const settled = await settleAll(providers.map((p) => [p, () => QUOTERS[p](ctx)] as const));
    const alternatives: BridgeAlternative[] = [];
    const usable: ProviderQuote[] = [];
    for (const r of settled) {
      if (!r.ok) {
        this.log.warn({ provider: r.key, err: errorText(r.error) }, "bridge quote failed");
        alternatives.push({ provider: r.key, minReceived: null, etaSec: null, error: errorText(r.error) });
        continue;
      }
      const why = stepRefusal(monad, monadToken.address, r.value.steps);
      if (why) {
        this.log.error({ provider: r.key, why }, "bridge quote refused");
        alternatives.push({ provider: r.key, minReceived: r.value.minReceived, etaSec: r.value.etaSec, error: why });
      } else usable.push(r.value);
    }
    usable.sort((a, b) =>
      a.minReceived === b.minReceived ? a.etaSec - b.etaSec : a.minReceived > b.minReceived ? -1 : 1,
    );
    const [best, ...rest] = usable;
    for (const q of rest)
      alternatives.push({ provider: q.provider, minReceived: q.minReceived, etaSec: q.etaSec, error: null });
    if (!best) return { status: "unsupported", ...base, reason: "No provider could quote this transfer", alternatives };
    const id = best.trackingId ?? "{txHash}";
    return {
      status: "ok",
      ...base,
      provider: best.provider,
      direction,
      remote: { asset: remoteAsset, ...remoteToken },
      out: best.out,
      amountIn: input.amount,
      amountOut: best.amountOut,
      minReceived: best.minReceived,
      fees: best.fees,
      etaSec: best.etaSec,
      steps: best.steps,
      tracking: { id: best.trackingId, byTxHash: best.trackingId === null },
      statusUrl: `/v1/bridge/status?route=${best.provider}&fromChain=${input.fromChain}&toChain=${input.toChain}&id=${id}`,
      expiresAt: best.expiresAt,
      alternatives,
    };
  }

  /**
   * A Relay deposit address on `fromChain` for the user's own Monad wallet (B4 step 4, open mode). The route must be a
   * listed inbound route; Relay is asked whatever providers the route lists (its solvers fill the deposit address even
   * where another bridge quotes the wallet-signed transfer best). Mainnet only: Relay doesn't serve 10143.
   */
  async depositAddress(input: DepositAddressInput): Promise<BridgeDepositAddressResponse> {
    const at = new Date().toISOString();
    const base = { at, fromChain: input.fromChain, toChain: input.toChain, asset: input.asset };
    const unsupported = (reason: string): BridgeDepositAddressResponse => ({ status: "unsupported", ...base, reason });
    if (input.toChain !== MAINNET_CHAIN_ID) return unsupported("Mainnet only");
    const route = bridgeRoute(input.toChain, input.asset, "in", input.fromChain);
    const chain = bridgeChain(input.fromChain);
    if (!route || !chain) return unsupported(`No route for ${input.asset} from this chain`);
    if (chain.vm !== "evm" && !this.relayKey) return unsupported("Deposit address needs a Relay key");
    const remoteAsset = input.remote ?? route.remote[0];
    if (!remoteAsset || !route.remote.includes(remoteAsset)) return unsupported(`${input.remote} is not served here`);
    const remoteToken = chain.tokens[remoteAsset];
    const monadToken = MONAD_BRIDGE_ASSETS[input.toChain][input.asset];
    if (!remoteToken || !monadToken) return unsupported("asset not listed on this chain");
    if (input.amount <= 0n) throw bad("amount must be positive");
    const ctx: QuoteContext = {
      monadChainId: input.toChain,
      direction: "in",
      asset: input.asset,
      remoteAsset,
      remoteChain: chain,
      from: { chainId: input.fromChain, token: remoteToken },
      to: { chainId: input.toChain, token: monadToken },
      amount: input.amount,
      sender: input.recipient,
      recipient: input.recipient,
    };
    let q: Awaited<ReturnType<typeof relayDepositAddress>>;
    try {
      q = await relayDepositAddress(ctx, input.recipient, this.relayKey);
    } catch (error) {
      const text = errorText(error);
      this.log.warn({ err: text, fromChain: input.fromChain, asset: input.asset }, "deposit address failed");
      // Relay: "Amount must be greater than 50000 for deposit address quotes" (AMOUNT_TOO_LOW) — B4's below-minimum
      // state, named before any address is shown.
      const low = /amount must be greater|amount_too_low/i.test(text);
      return unsupported(low ? "Below minimum" : "No deposit address for this route");
    }
    return {
      status: "ok",
      ...base,
      provider: "relay",
      mode: "open",
      remote: { asset: remoteAsset, ...remoteToken },
      depositAddress: q.depositAddress,
      recipient: input.recipient,
      amountIn: input.amount,
      amountOut: q.amountOut,
      minReceived: q.minReceived,
      out: q.out,
      fees: q.fees,
      etaSec: q.etaSec,
      requestId: q.requestId,
      quoteExpiresAt: q.quoteExpiresAt,
      addressExpiresAt: q.addressExpiresAt,
      statusUrl: `/v1/bridge/deposit-status?fromChain=${input.fromChain}&depositAddress=${q.depositAddress}`,
    };
  }

  /** Every deposit Relay has seen at a deposit address (newest first). */
  async depositStatus(fromChain: number, depositAddress: string): Promise<BridgeDepositStatus> {
    const chain = bridgeChain(fromChain);
    if (!chain) throw bad("unknown chain");
    if (!RECIPIENT[chain.vm].test(depositAddress)) throw bad(`not a ${chain.vm} address`);
    const deposits = await relayDeposits(depositAddress, this.relayKey);
    return { depositAddress, at: new Date().toISOString(), deposits };
  }

  async status(route: BridgeProvider, id: string, fromChain: number, toChain?: number): Promise<BridgeStatus> {
    if (route === "aurora") throw bad("Aurora transfers are not served yet");
    if (route !== "relay" && !TX_HASH.test(id)) throw bad(`${route} is tracked by the source tx hash`);
    const monadChainId = ([fromChain, toChain].find((c) => c !== undefined && isChainId(c)) ??
      MAINNET_CHAIN_ID) as ChainId;
    const result = await STATUS[route]({ monadChainId, id, fromChain, toChain });
    return { route, id, at: new Date().toISOString(), ...result };
  }
}
