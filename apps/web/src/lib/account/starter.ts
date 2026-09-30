/**
 * Starter relay (D-030, F05) over S3's `@senryo/api-client` routes — schemas as-is (`starterStatusRoute`,
 * `starterClaimRoute`, `starterVoucherRoute`, `starterRelayRoute`). The user signs; the sponsor relays and pays gas.
 * Any transport failure (relay not deployed, offline) is `UNREACHABLE` — the honest "relay offline" state.
 */
import type { Address, SignedClaim, SignedVoucher } from "@senryo/account";
import {
  ApiError,
  type ApiErrorCode,
  type RelayResponse,
  starterClaimRoute,
  starterRelayRoute,
  starterStatusRoute,
  starterVoucherRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { isTerminalStage } from "@senryo/core";
import { api } from "./api";

export type RelayResult = RelayResponse;
export const isTerminal = (relay: RelayResult) => isTerminalStage(relay.stage);

export type StarterErrorCode =
  | "ALREADY_CLAIMED"
  | "RATE_LIMITED"
  | "BUDGET_EXHAUSTED"
  | "VOUCHER_INVALID"
  | "VOUCHER_USED"
  | "VOUCHER_CAP_REACHED"
  | "SIGNATURE_INVALID"
  | "SIGNATURE_EXPIRED"
  | "GEO_BLOCKED"
  | "RELAYER_BUSY"
  | "RELAY_REVERTED"
  | "NOT_DEPLOYED"
  | "UNREACHABLE"
  | "UNKNOWN";

const PASS_THROUGH: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "ALREADY_CLAIMED",
  "RATE_LIMITED",
  "BUDGET_EXHAUSTED",
  "VOUCHER_INVALID",
  "VOUCHER_USED",
  "VOUCHER_CAP_REACHED",
  "SIGNATURE_INVALID",
  "SIGNATURE_EXPIRED",
  "GEO_BLOCKED",
  "RELAYER_BUSY",
  "RELAY_REVERTED",
  "NOT_DEPLOYED",
]);

export class StarterError extends Error {
  readonly code: StarterErrorCode;
  readonly retryAfterSec: number | undefined;
  constructor(code: StarterErrorCode, retryAfterSec?: number) {
    super(`Starter relay: ${code}`);
    this.name = "StarterError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

function toStarterError(error: unknown): StarterError {
  if (error instanceof ApiError) {
    if (PASS_THROUGH.has(error.code)) return new StarterError(error.code as StarterErrorCode, error.retryAfterSec);
    if (error.code === "UPSTREAM_UNAVAILABLE") return new StarterError("RELAYER_BUSY", error.retryAfterSec);
    return new StarterError("UNKNOWN", error.retryAfterSec);
  }
  // fetch rejected (DNS, CORS, connection refused): the relay isn't reachable from here.
  return new StarterError("UNREACHABLE");
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toStarterError(error);
  }
}

export const starter = {
  status: (chainId: ChainId, user: Address) =>
    guarded(() => api().call(starterStatusRoute, { query: { chainId, user } })),
  claim: (signed: SignedClaim) =>
    guarded(() =>
      api().call(starterClaimRoute, {
        body: { chainId: signed.chainId, user: signed.user, deadline: signed.deadline, signature: signed.signature },
      }),
    ),
  voucher: (signed: SignedVoucher) =>
    guarded(() =>
      api().call(starterVoucherRoute, {
        body: {
          chainId: signed.chainId,
          user: signed.user,
          deadline: signed.deadline,
          signature: signed.signature,
          code: signed.code,
        },
      }),
    ),
  relay: (relayId: string) => guarded(() => api().call(starterRelayRoute, { params: { relayId } })),
};
