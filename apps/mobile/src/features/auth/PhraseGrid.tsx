/**
 * The 24 words after a step-up (RN port of 21st Encrypted Text #18575: each word decrypts in place). Screenshots and
 * recordings are blocked while mounted (expo-screen-capture, F07); hidden again after PHRASE_VISIBLE_MS or when the
 * app leaves the foreground; never copied or stored. The warning is a borderless wash; the words sit in one filled
 * group.
 */
import { usePreventScreenCapture } from "expo-screen-capture";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { PHRASE_VISIBLE_MS } from "~/lib/constants/auth";
import { BUTTON, SPACE, TYPE, useTheme } from "~/theme";

const CHARSET = "abcdefghijklmnopqrstuvwxyz";
const REVEAL_MS = 18;
const WORD_STAGGER_MS = 24;
const FRAME_MS = 16;

function scramble(word: string, revealed: number): string {
  const slot = new Uint8Array(word.length);
  crypto.getRandomValues(slot);
  return Array.from(word, (ch, i) => (i < revealed ? ch : CHARSET.charAt((slot[i] ?? 0) % CHARSET.length))).join("");
}

function Word({ word, index }: { word: string; index: number }) {
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? word : scramble(word, 0));
  useEffect(() => {
    if (reduced) return setShown(word);
    const start = Date.now() + index * WORD_STAGGER_MS;
    const id = setInterval(() => {
      const revealed = Math.max(0, Math.floor((Date.now() - start) / REVEAL_MS));
      setShown(scramble(word, revealed));
      if (revealed >= word.length) clearInterval(id);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [word, index, reduced]);
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${index + 1}. ${word}`}>
      <Text style={[TYPE.numSm, styles.index, { color: color.text3 }]}>{index + 1}</Text>
      <Text style={[TYPE.numSm, { color: shown === word ? color.ink : color.text3 }]}>{shown}</Text>
    </View>
  );
}

const CAPTURE_KEY = "senryo.recovery-phrase";

export function PhraseGrid({ phrase, onHide }: { phrase: string; onHide: () => void }) {
  const { color } = useTheme();
  usePreventScreenCapture(CAPTURE_KEY);
  useEffect(() => {
    const timer = setTimeout(onHide, PHRASE_VISIBLE_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") onHide();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [onHide]);
  const words = phrase.split(" ");
  return (
    <View style={styles.wrap}>
      <View style={[styles.warn, { backgroundColor: color.downWash }]}>
        <Text style={[TYPE.rowDetail, { color: color.down }]}>
          Anyone with these words controls this account. Write them down offline; never type them into a website.
        </Text>
      </View>
      <Panel style={styles.grid}>
        <View accessibilityRole="list" style={styles.words}>
          {words.map((w, i) => (
            <Word key={`${i}-${w}`} word={w} index={i} />
          ))}
        </View>
      </Panel>
      <Button label="Hide" variant="outline" onPress={onHide} />
    </View>
  );
}

const HALF = "50%";
const INDEX_WIDTH = SPACE.xl;

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  warn: { borderRadius: BUTTON.radius.md, padding: SPACE.md },
  grid: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.xs },
  words: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: HALF, flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  index: { width: INDEX_WIDTH, textAlign: "right" },
});
