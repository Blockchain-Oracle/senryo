/**
 * Starter relay client (D-030, F05) behind a small interface. Shapes follow S3's `@senryo/api-client` routes
 * (`starterStatusRoute`, `starterClaimRoute`, `starterVoucherRoute`, `starterRelayRoute`); S6.12 swaps this module
 * for the api-client at merge. bigints travel as decimal strings. The user signs; the sponsor relays and pays gas.
 */
import type { Address, Hex, SignedClaim, SignedVoucher } from "@senryo/account";

export type RelayStage = "submitted" | "proposed" | "voted" | "finalized" | "reverted" | "abandoned";
export const TERMINAL_STAGES: readonly RelayStage[] = ["finalized", "reverted", "abandoned"];

export interface RelayResult {
  relayId: string;
  kind: string;
  chainId: number;
  user: Address;
  txHash: Hex;
  stage: RelayStage;
  creditUsd6: bigint;
  nativeWei: bigint;
}

export interface StarterStatus {
  claimed: boolean;
  practiceUsd6: bigint;
  dripWei: bigint;
  nextClaimAt: string | undefined;
}

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

export interface StarterClient {
  status(chainId: number, user: Address): Promise<StarterStatus>;
  claim(signed: SignedClaim): Promise<RelayResult>;
  voucher(signed: SignedVoucher): Promise<RelayResult>;
  relay(relayId: string): Promise<RelayResult>;
}

const DEVICE_HEADER = "x-senryo-device";
const KNOWN = new Set<string>([
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

const big = (v: unknown): bigint => (typeof v === "string" || typeof v === "number" ? BigInt(v) : 0n);

function toRelay(raw: Record<string, unknown>): RelayResult {
  return {
    relayId: String(raw.relayId),
    kind: String(raw.kind),
    chainId: Number(raw.chainId),
    user: raw.user as Address,
    txHash: raw.txHash as Hex,
    stage: raw.stage as RelayStage,
    creditUsd6: big(raw.creditUsd6),
    nativeWei: big(raw.nativeWei),
  };
}

async function failure(res: Response): Promise<StarterError> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: unknown;
    error?: { code?: unknown };
    retryAfterSec?: unknown;
  };
  const code = String(body.code ?? body.error?.code ?? "");
  const retry =
    typeof body.retryAfterSec === "number" ? body.retryAfterSec : Number(res.headers.get("retry-after")) || undefined;
  return new StarterError(KNOWN.has(code) ? (code as StarterErrorCode) : "UNKNOWN", retry);
}

export function httpStarterClient(origin: string, device: string): StarterClient {
  async function call(path: string, init?: { method: "POST"; body: unknown }): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(`${origin}${path}`, {
        method: init?.method ?? "GET",
        headers: { "content-type": "application/json", [DEVICE_HEADER]: device },
        ...(init ? { body: JSON.stringify(init.body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) } : {}),
      });
    } catch {
      throw new StarterError("UNREACHABLE");
    }
    if (!res.ok) throw await failure(res);
    return (await res.json()) as Record<string, unknown>;
  }
  return {
    async status(chainId, user) {
      const raw = await call(`/v1/starter/status?chainId=${chainId}&user=${user}`);
      return {
        claimed: raw.claimed === true,
        practiceUsd6: big(raw.practiceUsd6),
        dripWei: big(raw.dripWei),
        nextClaimAt: typeof raw.nextClaimAt === "string" ? raw.nextClaimAt : undefined,
      };
    },
    async claim(signed) {
      return toRelay(await call("/v1/starter/claim", { method: "POST", body: signed }));
    },
    async voucher(signed) {
      return toRelay(await call("/v1/starter/voucher", { method: "POST", body: signed }));
    },
    async relay(relayId) {
      return toRelay(await call(`/v1/starter/relays/${encodeURIComponent(relayId)}`));
    },
  };
}
