/**
 * An asset's real mark (rule 7): the registry's own art when it has it (MON, AUSD, USDC, the listed spot tokens), else
 * the token list's (or GeckoTerminal's) logo drawn as a disc, else the labelled monogram an unknown token gets — never
 * a dot or a guessed logo. `badge` adds a network or venue mark as a separate layer.
 */
import { hasArt } from "@senryo/identity";
import { Image, StyleSheet, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { imageModule } from "~/lib/native-modules";
import { RADIUS, useTheme } from "~/theme";

export interface MarkSource {
  mark: string;
  symbol: string;
  logoUrl: string | null;
}

export function AssetMark({ asset, size, ground }: { asset: MarkSource; size: number; ground?: string }) {
  const { color } = useTheme();
  if (hasArt(asset.mark) || !asset.logoUrl) {
    return <EntityMark id={asset.mark} label={asset.symbol} size={size} decorative {...(ground ? { ground } : {})} />;
  }
  const expo = imageModule();
  const disc = [styles.disc, { width: size, height: size, backgroundColor: color.raised2 }];
  return (
    <View style={disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {expo ? (
        <expo.Image source={{ uri: asset.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Image source={{ uri: asset.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderRadius: RADIUS.pill, overflow: "hidden" },
});
