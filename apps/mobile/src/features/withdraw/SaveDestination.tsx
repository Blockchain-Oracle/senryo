/**
 * "Save as…" after a withdrawal to a new address (B8 after, B13): one field for its name ("Coinbase") and Save; the
 * destination then leads the Monad list, with its exchange's mark when the name says which.
 */
import { useState } from "react";
import { Text, View } from "react-native";
import { SearchField, TextTool } from "~/features/money/SearchField";
import { SPACE, TYPE, useTheme } from "~/theme";

const NAME_MAX = 32;

export function SaveDestination({ onSave }: { onSave: (name: string) => void }) {
  const { color } = useTheme();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  if (saved) return <Text style={[TYPE.rowDetail, { color: color.up }]}>Saved as {name.trim()}</Text>;
  return (
    <View style={{ gap: SPACE.xs }}>
      <SearchField
        value={name}
        onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
        placeholder="Save as · e.g. Coinbase"
        label="Name this destination"
        input={{ maxLength: NAME_MAX }}
        tools={
          name.trim() ? (
            <TextTool
              label="Save"
              onPress={() => {
                onSave(name.trim());
                setSaved(true);
              }}
            />
          ) : undefined
        }
      />
    </View>
  );
}
