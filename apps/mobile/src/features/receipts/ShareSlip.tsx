/**
 * A receipt with its actions on the phone (R5.21, D-352; Codex direction 18 §A): the slip, then one row of action
 * circles — the lead (Replay ▶ for a finished trade, Live for an open one), Post with X's own mark (a post with the
 * result's tiered words and the slip's link), Share and Save (the slip as an image). The slip always shows the PnL
 * with its ROI; an open position shows what it's worth now from the live book (`LiveShareSlip`). Everything waits
 * while balances are hidden (D-329).
 */

import { bookFigure, postLink, type ShareFigure, type TradeSlip as Slip, sharedSlip, shareWords } from "@senryo/calls";
import { useBookEntry } from "@senryo/calls/react";
import { ids } from "@senryo/identity";
import type { ReactNode } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ActionCircle, ActionCircles } from "~/components/kit/ActionCircle";
import { Download, Share } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { SIZE, SPACE } from "~/theme";
import { TradeSlip } from "./TradeSlip";
import { useSlipImage } from "./useSlipImage";

const BLOCKED = { title: "Balances are hidden", description: "Show balances to share this trade." };

export function ShareSlip({
  slip,
  figure,
  side,
  lead,
}: {
  slip: Slip;
  figure: ShareFigure | null;
  side: string;
  /** The row's first circle: Replay, or Live for an open trade. */
  lead: ReactNode;
}) {
  const [hidden] = useHideBalances();
  const shown = figure ? sharedSlip(slip, figure) : slip;
  const image = useSlipImage(shown);
  const post = () => {
    fire("tick");
    if (hidden) return notify(BLOCKED);
    if (figure) void Linking.openURL(postLink(shareWords(figure, slip.symbol, side), slip.url));
  };
  return (
    <View style={styles.wrap}>
      <TradeSlip slip={shown} />
      <ActionCircles>
        {lead}
        <ActionCircle
          glyph={<EntityMark id={ids.brand("x")} size={SIZE.icon} variant="mono" decorative />}
          label="Post"
          accessibilityLabel="Post on X"
          reason={figure ? undefined : ""}
          onPress={post}
        />
        <ActionCircle icon={Share} label="Share" busy={image.busy === "share"} onPress={image.share} />
        <ActionCircle icon={Download} label="Save" busy={image.busy === "save"} onPress={image.save} />
      </ActionCircles>
      {image.node}
    </View>
  );
}

/** An open position's slip, shared at what the live book says it's worth now (unvalued: no post yet). */
export function LiveShareSlip({
  slip,
  entryKey,
  side,
  lead,
}: {
  slip: Slip;
  entryKey: string;
  side: string;
  lead: ReactNode;
}) {
  const entry = useBookEntry(entryKey);
  return <ShareSlip slip={slip} figure={entry ? bookFigure(entry) : null} side={side} lead={lead} />;
}

const styles = StyleSheet.create({ wrap: { gap: SPACE.lg } });
