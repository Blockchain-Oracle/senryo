import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { LegalDocument } from "./content";

/** A legal document as a plain reading page: title, date, then headed paragraphs. No boxes; it is text to be read. */
export function LegalPage({ document }: { document: LegalDocument }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + SPACE.xxl }]}
    >
      <Text accessibilityRole="header" style={[TYPE.stepTitle, { color: color.ink }]}>
        {document.title}
      </Text>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Updated {document.updated} · Draft</Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>{document.intro}</Text>
      {document.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
            {s.heading}
          </Text>
          <Text style={[TYPE.body, { color: color.text2 }]}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.lg, gap: SPACE.lg },
  section: { gap: SPACE.xs },
});
