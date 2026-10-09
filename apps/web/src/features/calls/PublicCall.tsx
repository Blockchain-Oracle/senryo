"use client";
/**
 * A shared call's public receipt (`/call?id=&chainId=`, the share card's link): the receipt read without an account.
 */
import { PublicQuery } from "@/components/public/public-query";
import { CallReceipt } from "./CallReceipt";

const TICKET_ID = /^\d{1,78}$/;

export function PublicCall() {
  return (
    <PublicQuery loading="Loading the call…">
      {(chainId, params) => {
        const id = params.get("id") ?? "";
        if (!TICKET_ID.test(id) || !params.get("chainId"))
          return <p className="text-body text-text-2">This link doesn't name a call. Ask for the link again.</p>;
        return <CallReceipt ticketId={BigInt(id)} chainId={chainId} publicView />;
      }}
    </PublicQuery>
  );
}
