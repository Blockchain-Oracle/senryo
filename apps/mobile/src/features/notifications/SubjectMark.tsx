/**
 * The mark an inbox row shows (G1; Part A rule 3 — real identity, never a dot): the market's or token's own mark, the
 * person's avatar (their chosen portrait when their profile says so), and the Senryo seal for the account as a whole.
 */
import type { NotificationSubject } from "@senryo/api-client";
import { ids, marketId } from "@senryo/identity";
import { useProfile } from "@senryo/query";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { SIZE, useTheme } from "~/theme";

const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
export const SUBJECT_MARK = SIZE.avatarMd;

export function SubjectMark({ subject, chainId }: { subject: NotificationSubject | null; chainId: number }) {
  const { color } = useTheme();
  switch (subject?.kind) {
    case "market":
      return <EntityMark id={marketId(subject.marketId)} size={SUBJECT_MARK} decorative />;
    case "token":
      return (
        <EntityMark
          id={
            subject.address.toLowerCase() === NATIVE_TOKEN
              ? ids.native(chainId, "MON")
              : ids.token(chainId, subject.address)
          }
          size={SUBJECT_MARK}
          label={subject.symbol}
          decorative
        />
      );
    case "person":
      return <PersonMark address={subject.address} />;
    default:
      return (
        <EntityMark id={ids.brand("senryo")} size={SUBJECT_MARK} variant="symbol" decorative ground={color.ground} />
      );
  }
}

function PersonMark({ address }: { address: string }) {
  const profile = useProfile(address);
  const avatar = profile.status === "fresh" || profile.status === "stale" ? profile.value.avatar : undefined;
  return <Avatar avatar={avatar ?? null} address={address} size={SUBJECT_MARK} />;
}
