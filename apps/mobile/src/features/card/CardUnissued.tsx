/**
 * The Card tab before a card (§0.9 "Card tab, unissued"; E1 step 1; Solflare S16/S18 grammar): the Kinpaku art
 * floating with a gentle tilt and no numbers, one title, one line, one action — and "How it works" to reopen the
 * explainer. Every state is a title and one action: guest (create an account), locked (unlock), a named problem (the
 * action that fixes its cause — switch to Practice, sign in again, retry — never an error wall), loading (skeleton,
 * never "$0").
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";
import { CardFace } from "./CardFace";
import { CardHero } from "./CardHero";
import { CARD_PROBLEM_COPY, type CardProblem } from "./card-problem";

export type UnissuedState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "locked"; unlock: () => void }
  | { kind: "problem"; problem: CardProblem; act: () => void; acting: boolean }
  | { kind: "get"; practice: boolean; onGet: () => void };

const TITLE_SKELETON = 220;
const LINE_SKELETON = 160;

export function CardUnissued({ state }: { state: UnissuedState }) {
  const { color } = useTheme();
  const copy = state.kind === "problem" ? CARD_PROBLEM_COPY[state.problem] : COPY[state.kind];
  return (
    <View style={styles.page}>
      <View style={styles.art}>
        <CardHero floating>
          <CardFace />
        </CardHero>
      </View>
      <View style={styles.copy}>
        {state.kind === "loading" ? (
          <>
            <Skeleton width={TITLE_SKELETON} />
            <Skeleton width={LINE_SKELETON} />
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
              {copy.title}
            </Text>
            {copy.line ? <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{copy.line}</Text> : null}
          </>
        )}
      </View>
      <View style={styles.actions}>
        <Action state={state} />
        {state.kind === "get" || state.kind === "guest" ? (
          <Pressable
            onPress={() => router.push(ROUTES.cardIntro)}
            accessibilityRole="button"
            hitSlop={SPACE.sm}
            style={styles.how}
          >
            <Text style={[TYPE.rowDetail, { color: color.link }]}>How it works</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const COPY: Record<Exclude<UnissuedState["kind"], "problem">, { title: string; line?: string }> = {
  loading: { title: "" },
  guest: { title: "Get your Kinpaku card", line: "Spends your free balance" },
  locked: { title: "Unlock to see your card" },
  get: { title: "Get your Kinpaku card", line: "Spends your free balance" },
};

function Action({ state }: { state: UnissuedState }) {
  switch (state.kind) {
    case "loading":
      return null;
    case "guest":
      return <Button label="Create account" onPress={() => router.push(ROUTES.accountRequired)} />;
    case "locked":
      return <Button label="Unlock" onPress={state.unlock} />;
    case "problem":
      return (
        <Button
          label={CARD_PROBLEM_COPY[state.problem].action}
          variant={state.problem === "practice-only" || state.problem === "sign-in" ? "primary" : "secondary"}
          loading={state.acting}
          onPress={state.act}
        />
      );
    case "get":
      return <Button label={state.practice ? "Instant test card" : "Get card"} onPress={state.onGet} />;
  }
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl, paddingTop: SPACE.lg },
  art: { paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg },
  copy: { gap: SPACE.sm, alignItems: "center", minHeight: SPACE.xxxl },
  center: { textAlign: "center" },
  actions: { gap: SPACE.md },
  how: { alignSelf: "center" },
});
