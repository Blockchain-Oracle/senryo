/**
 * The passkey relying party for this page. Production is always `RP_ID` (senryo.xyz — it *is* the account). For local
 * acceptance only, a development server may name another rpId (`NEXT_PUBLIC_DEV_RP_ID=localhost`): Next replaces
 * `process.env.NODE_ENV` with "production" in every production build, so the override branch is dead code there and is
 * removed by the minifier — the shipped site can never be pointed at another relying party. A passkey made on a
 * development rpId opens a different (test) account; it never reaches senryo.xyz accounts.
 */
import { RP_ID } from "@senryo/config";

const devRpId = process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_RP_ID : undefined;

export const WEB_RP_ID: string = devRpId && devRpId.length > 0 ? devRpId : RP_ID;
