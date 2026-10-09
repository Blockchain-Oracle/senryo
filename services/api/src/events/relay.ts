import {
  type Address,
  addressOf,
  describeError,
  type EventChange,
  eventCallSigner,
  eventChanges,
  type Hex,
  type MarketEventCall,
  type PermitArgs,
  placeEventCallData,
  type ReadClient,
  readEventAccount,
  sendTx,
} from "@senryo/chain";
import { type ChainId, EVENT_LIMITS, EVENTS } from "@senryo/config";
import { applyEventChanges, type Db, eventById, type Logger, nowSec } from "@senryo/service-common";
import { bad } from "../relay/gates.ts";
import type { MarketRelay } from "../relay/relay.ts";

/**
 * A yes/no call (S8.7, D-296): the owner's signed `EventCall`, checked here against the book (open, before the close,
 * inside the limits, the owner's own signature, enough dollars and allowance) so a doomed one costs no gas, then sent
 * as `placeCall` on the caller's lane. The book's events in the receipt drive `event_calls` and the board's pools.
 */
export interface EventCallRequest {
  chainId: ChainId;
  call: MarketEventCall;
  signature: Hex;
  permit: PermitArgs | null;
}

/** Calls stop this long before the book's close, so one sent now still lands in time. */
const CLOSE_MARGIN_SEC = 5;

export class EventRelay {
  private readonly placing = new Set<string>();

  constructor(private readonly d: { chainId: ChainId; read: ReadClient; relay: MarketRelay; db: Db; log: Logger }) {}

  get book(): Address {
    return addressOf(this.d.chainId, "EventBook");
  }

  async place(req: EventCallRequest): Promise<{ ticketId: bigint; txHash: Hex }> {
    const { call } = req;
    const limits = EVENT_LIMITS[this.d.chainId];
    if (!limits) throw bad("events are Practice only");
    const e = await eventById(this.d.db, this.d.chainId, call.eventId);
    if (e?.state !== "open") throw bad("this question isn't taking calls");
    const now = nowSec();
    if (now + CLOSE_MARGIN_SEC >= Number(e.closes_at)) throw bad("calls on this question have closed");
    if (call.stake < limits.minStake || call.stake > limits.maxStake) throw bad("the stake is outside the limits");
    if (Number(call.deadline) > now + EVENTS.callTtlSec + CLOSE_MARGIN_SEC) throw bad("the call's deadline is too far");
    const signer = await eventCallSigner(this.d.chainId, call, req.signature);
    if (signer.toLowerCase() !== call.owner.toLowerCase()) throw bad("a call is signed by its owner");
    const account = await readEventAccount(this.d.read, this.d.chainId, call.owner);
    if (account.epoch !== call.epoch) throw bad("signed before a revoke; sign again");
    if (account.balance < call.stake) throw bad("not enough dollars for this stake");
    const allowed = account.allowance >= call.stake || (req.permit !== null && req.permit.value >= call.stake);
    if (!allowed) throw bad("the book can't take this stake yet: sign its allowance with the call");

    const key = `${call.owner.toLowerCase()}:${call.nonce}`;
    if (this.placing.has(key)) throw bad("this call is already on its way");
    this.placing.add(key);
    try {
      const sent = await this.d.relay.laneFor(call.owner).run((sender) =>
        sendTx(sender, {
          to: this.book,
          data: placeEventCallData(call, req.signature, req.permit),
          action: "eventCall",
          meta: { event: call.eventId, side: call.yes ? "yes" : "no" },
        }),
      );
      if (sent.stage === "reverted") throw bad(`the book refused the call (${sent.hash})`);
      const changes = eventChanges(sent.receipt.logs, this.book);
      await applyEventChanges(this.d.db, this.d.chainId, changes, sent.hash);
      const called = changes.find((c): c is Extract<EventChange, { kind: "called" }> => c.kind === "called");
      if (!called) throw bad(`the call left no ticket (${sent.hash})`);
      this.d.log.info(
        { actor: "relay", event: call.eventId, ticket: called.ticketId.toString(), tx: sent.hash },
        "event call placed",
      );
      return { ticketId: called.ticketId, txHash: sent.hash };
    } catch (error) {
      this.d.log.warn({ event: call.eventId, owner: call.owner, err: describeError(error) }, "event call failed");
      throw error;
    } finally {
      this.placing.delete(key);
    }
  }
}
