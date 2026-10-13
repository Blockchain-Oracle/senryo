/**
 * A slip with its share on the phone (R5.21; the web's `ShareSlip`): PnL · ROI · Both changes the slip's figure, the
 * image and the post alike; Share or save hands the slip as shown to the system sheet; Post on X opens a post with
 * the result's tiered words and the slip's link. An open position shares what it's worth now from the live book
 * (`LiveShareSlip`); without a figure the slip stands alone. Everything waits while balances are hidden (D-329).
 */
import {
  bookFigure,
  postLink,
  SHARE_MODES,
  type ShareFigure,
  type ShareMode,
  type TradeSlip as Slip,
  sharedSlip,
  shareWords,
} from "@senryo/calls";
import { useBookEntry } from "@senryo/calls/react";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { fire } from "~/feedback/fire";
import { useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { SPACE } from "~/theme";
import { SlipShare } from "./SlipShare";
import { TradeSlip } from "./TradeSlip";

const BLOCKED = { title: "Balances are hidden", description: "Show balances to share this trade." };

export function ShareSlip({ slip, figure, side }: { slip: Slip; figure: ShareFigure | null; side: string }) {
  const [mode, setMode] = useState<ShareMode>("both");
  const [hidden] = useHideBalances();
  if (!figure) return <TradeSlip slip={slip} />;
  const shown = sharedSlip(slip, figure, mode);
  const post = () => {
    fire("tick");
    if (hidden) return notify(BLOCKED);
    void Linking.openURL(postLink(shareWords(figure, slip.symbol, side), slip.url));
  };
  return (
    <View style={styles.wrap}>
      <TradeSlip slip={shown} />
      <Segmented options={SHARE_MODES} value={mode} onChange={setMode} label="What the share shows" />
      <SlipShare slip={shown} />
      <Button label="Post on X" variant="secondary" onPress={post} />
    </View>
  );
}

/** An open position's slip, shared at what the live book says it's worth now (the slip alone while unvalued). */
export function LiveShareSlip({ slip, entryKey, side }: { slip: Slip; entryKey: string; side: string }) {
  const entry = useBookEntry(entryKey);
  return <ShareSlip slip={slip} figure={entry ? bookFigure(entry) : null} side={side} />;
}

const styles = StyleSheet.create({ wrap: { gap: SPACE.md } });
