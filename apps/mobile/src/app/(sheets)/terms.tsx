import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Coins, KeyRound, type SymbolIcon, TriangleAlert } from "~/components/kit/symbols";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { AgreeRow } from "~/features/legal/AgreeRow";
import { acknowledgeTerms } from "~/features/legal/acknowledged";
import { InfoTip } from "~/features/setup/InfoTip";
import { completeSetupStep } from "~/features/setup/progress";
import { goToSetupStep } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useTermsRequest } from "~/lib/account/terms-gate";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The three things that matter, each a row; the full sentence lives behind its ⓘ. */
const POINTS: readonly { title: string; detail: string; icon: SymbolIcon }[] = [
  {
    title: "Your passkey is your account",
    detail: "Only you hold it. Nobody, including Senryo, can recover it or move your funds.",
    icon: KeyRound,
  },
  {
    title: "A call can lose its whole stake",
    detail:
      "If the price closes on the wrong side of the line, the stake goes to the pool. Cash out before then to keep part of it.",
    icon: TriangleAlert,
  },
  {
    title: "Practice dollars have no value",
    detail: "Practice uses test dollars on a test network. Real money starts only when you switch to Real.",
    icon: Coins,
  },
];

/**
 * The terms (A11; Fomo F08): a compact sheet over Home — three rows with ⓘ, one checkbox, Continue (the quiet plate
 * until it is checked). Two callers: setup's last step (`?setup=1`, cannot be dismissed — it is the one step with no
 * Skip) and the gate before the first money action (`useTermsGate`; dismissing it leaves the action undone). Agreeing
 * stores the terms version for this address on this phone; a newer version asks again.
 */
export default function TermsSheet() {
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const request = useTermsRequest();
  const owed = setup === "1";
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close terms" dismissible={!owed}>
      <Body owed={owed} settle={request?.settle} />
    </Sheet>
  );
}

function Body({ owed, settle }: { owed: boolean; settle: ((agreed: boolean) => void) | undefined }) {
  const { color } = useTheme();
  const close = useSheetClose();
  const address = useAccount().hint?.address;
  const [agreed, setAgreed] = useState(false);
  const settled = useRef(false);
  // Dismissed without agreeing: the gated action stays undone (silent, like a cancelled passkey).
  useEffect(
    () => () => {
      if (!settled.current) settle?.(false);
    },
    [settle],
  );
  const agree = () => {
    if (!address) return;
    settled.current = true;
    acknowledgeTerms(address);
    const following = owed ? completeSetupStep(address, "terms") : undefined;
    fire("confirm");
    close(() => {
      settle?.(true);
      // The first run moves on to its next page (test dollars) the moment the terms are agreed.
      if (owed) goToSetupStep(following);
    });
  };
  return (
    <>
      <SheetHeading title="Before you start" />
      <View style={styles.points}>
        {POINTS.map((p) => (
          <View key={p.title} style={styles.point}>
            <p.icon size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
            <Text style={[TYPE.rowTitle, styles.flex, { color: color.ink }]} numberOfLines={1}>
              {p.title}
            </Text>
            <InfoTip title={p.title} body={p.detail} />
          </View>
        ))}
      </View>
      <AgreeRow
        checked={agreed}
        onToggle={() => setAgreed((v) => !v)}
        onTerms={() => router.push(ROUTES.accountTerms as Href)}
        onPrivacy={() => router.push(ROUTES.accountPrivacy as Href)}
      />
      <Button label="Continue" disabled={!agreed || !address} onPress={agree} />
    </>
  );
}

const styles = StyleSheet.create({
  points: { gap: SPACE.xs },
  point: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch },
  flex: { flex: 1 },
});
