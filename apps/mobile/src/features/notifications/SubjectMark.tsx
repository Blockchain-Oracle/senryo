/**
 * The mark an inbox row shows (G1; Part A rule 3 — real identity, never a dot): the market's or token's own mark, the
 * person's avatar (their chosen portrait when their profile says so), the Kinpaku card art for card news, and the
 * Senryo seal for the account as a whole.
 */
import type { NotificationSubject } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import { useProfile } from "@senryo/query";
import { Image, StyleSheet, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { indexedMarketMark } from "~/features/portfolio/market-id";
import { RADIUS, SIZE, useTheme } from "~/theme";

const CARD_ART = require("../../../assets/images/kinpaku-card.png");
const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
export const SUBJECT_MARK = SIZE.avatarMd;

export function SubjectMark({ subject, chainId }: { subject: NotificationSubject | null; chainId: number }) {
  const { color } = useTheme();
  switch (subject?.kind) {
    case "market":
      return <EntityMark id={indexedMarketMark(chainId, subject.marketId)} size={SUBJECT_MARK} decorative />;
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
    case "card":
      return (
        <View style={[styles.cardTile, { backgroundColor: color.raised2 }]}>
          <Image source={CARD_ART} style={styles.card} resizeMode="contain" />
        </View>
      );
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

const styles = StyleSheet.create({
  cardTile: {
    width: SUBJECT_MARK,
    height: SUBJECT_MARK,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  card: { width: SUBJECT_MARK - SIZE.iconSm / 2, aspectRatio: SIZE.cardAspect },
});
