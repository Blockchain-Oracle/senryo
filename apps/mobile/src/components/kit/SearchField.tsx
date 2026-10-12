/**
 * A search pill (Markets, the market sheet, Parlay): the icon, the field and the system clear button, on the muted
 * plate. `onFocus` lets a sheet rise to its full height before the keyboard arrives (D-321).
 */
import { StyleSheet, TextInput, View } from "react-native";
import { Search } from "~/components/kit/symbols";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SEARCH_ICON = 18;

export function SearchField({
  value,
  onChange,
  onFocus,
  placeholder = "Search markets",
}: {
  value: string;
  onChange: (next: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: color.muted }]}>
      <Search size={SEARCH_ICON} color={color.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        {...(onFocus ? { onFocus } : {})}
        placeholder={placeholder}
        placeholderTextColor={color.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[TYPE.body, styles.input, { color: color.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  input: { flex: 1, minHeight: SIZE.touch },
});
