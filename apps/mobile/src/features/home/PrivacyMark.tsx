import { ids } from "@senryo/identity";
import { NATIVE_ART } from "@senryo/identity/native";
import { View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { EntityMark } from "~/components/identity/EntityMark";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Existing authored Senryo artwork replaces the competitor's concealment stickers. */
export const PRIVACY_MARKS = ["koban", "kitsune", "seal"] as const;
export type PrivacyMarkName = (typeof PRIVACY_MARKS)[number];

export function usePrivacyMark(): [PrivacyMarkName, (name: PrivacyMarkName) => void] {
  const [saved, setSaved] = useMMKVString(STORAGE_KEYS.privacyMark, storage);
  return [saved === "kitsune" || saved === "seal" ? saved : "koban", setSaved];
}

export function PrivacyMark({ name, size = 48 }: { name: PrivacyMarkName; size?: number }) {
  const Art = NATIVE_ART[name === "kitsune" ? "avatar-12-kitsune" : "xau-koban"]?.symbol;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === "seal" ? (
        <EntityMark id={ids.brand("senryo")} size={size} variant="symbol" decorative />
      ) : Art ? (
        <Art width={size} height={size} />
      ) : null}
    </View>
  );
}
