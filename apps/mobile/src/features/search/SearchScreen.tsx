/**
 * The phone's search (R6.9, UGLYCASH U10 S02–S05, Codex direction 13): a full page over the dock — Back, the filled
 * field with its clear, then the groups (a top hit, then by best hit); with nothing typed, Recent, your positions, Hot
 * · 24 h and Go to. Dragging the list lets the keyboard go; a result taps with the keyboard up; the keyboard's Search
 * only dismisses it. A pasted hash or call number looks itself up. Nothing here moves money.
 */
import { lookupKeys } from "@senryo/query";
import { shortHash } from "@senryo/search";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Search, X } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAppTrader } from "~/lib/account/guest";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { SearchRow } from "./SearchRows";
import { useAppSearch } from "./useAppSearch";

const HEADER = 52;
const FIELD = 44;
const FIELD_ICON = 20;
const CLEAR_ICON = 18;
const BACK_ICON = 22;

export function SearchScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const guest = useAppTrader().guest;
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  const search = useAppSearch(query, true);
  useEffect(() => {
    fire("press", { cue: "sheetOpen" });
  }, []);
  const back = () => {
    fire("tick", { cue: "sheetClose" });
    router.back();
  };
  const lookup = search.lookup;
  const noMatch = !search.empty && search.sections.length === 0 && lookup.state === "idle";
  const note = (text: string, busy = false) => (
    <View style={styles.note}>
      {busy ? <ActivityIndicator color={color.inkMuted} /> : null}
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{text}</Text>
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <ChevronLeft size={BACK_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </Pressable>
        <View style={[styles.field, { backgroundColor: color.muted }]}>
          <Search size={FIELD_ICON} color={color.inkMuted} />
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search for anything"
            placeholderTextColor={color.inkMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel="Search Senryo"
            style={[TYPE.field, styles.input, { color: color.ink }]}
          />
          {query ? (
            <Pressable
              onPress={() => {
                fire("tick");
                setQuery("");
                input.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}
            >
              <X size={CLEAR_ICON} color={color.inkMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
      >
        {lookup.state === "looking"
          ? note(
              `Finding receipt… ${lookup.id.kind === "hash" ? `Transaction ${shortHash(lookup.id.value)}` : `#${lookup.id.value}`}`,
              true,
            )
          : null}
        {lookup.state === "none" && lookup.id.kind === "number"
          ? note(`No receipt found for #${lookup.id.value}`)
          : null}
        {lookup.state === "failed" ? (
          <View style={styles.note}>
            <Text style={[TYPE.body, { color: color.inkMuted }]}>Couldn't look up this receipt.</Text>
            <Pressable onPress={() => void client.invalidateQueries({ queryKey: lookupKeys.all })} hitSlop={SPACE.sm}>
              <Text style={[TYPE.bodyStrong, { color: color.link }]}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {search.empty && !search.sections.some((s) => s.key === "recent")
          ? note("Your recent visits appear here.")
          : null}
        {search.sections.map((s) => (
          <View key={s.key} style={styles.section}>
            <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
              {s.label}
            </Text>
            {s.hits.map(({ entry }) => (
              <SearchRow
                key={entry.id}
                entry={entry}
                onOpen={() => {
                  fire("press", { cue: "tap" });
                  search.open(entry);
                }}
                onOptions={(symbol) => {
                  fire("tick", { cue: "tap" });
                  router.push(`/search/${symbol}` as Href);
                }}
              />
            ))}
            {s.more ? (
              <Pressable onPress={() => router.navigate("/calls")} style={styles.more} accessibilityRole="button">
                <Text style={[TYPE.bodyStrong, { color: color.link }]}>
                  View all {s.more + s.hits.length} positions
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {search.empty && !guest && !search.sections.some((s) => s.key === "positions")
          ? note("No open positions.")
          : null}
        {noMatch ? (
          <View style={styles.none}>
            <Text style={[TYPE.sectionTitle, { color: color.ink }]}>No matches for “{query}”</Text>
            <Text style={[TYPE.body, { color: color.inkMuted }]}>Try a symbol, team, game, or receipt ID.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: HEADER,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.inset,
    gap: SPACE.sm,
  },
  back: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    height: FIELD,
    paddingLeft: SPACE.md,
    borderRadius: RADIUS.xs,
  },
  input: { flex: 1, height: FIELD },
  clear: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: SPACE.inset, gap: SPACE.xl, paddingTop: SPACE.lg },
  section: { gap: SPACE.xs },
  note: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.sm },
  more: { minHeight: SIZE.touch, justifyContent: "center" },
  none: { gap: SPACE.xs, paddingTop: SPACE.xl },
});
