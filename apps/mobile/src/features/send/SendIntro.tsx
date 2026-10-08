import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
/** U11 primer adapted to the real supported network and confirmation contract. */
export function SendIntro({ network, onContinue }: { network: string; onContinue: () => void }) {
  const { color } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.art}>
        <Image
          source={require("../../../assets/money/send-texture.png")}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
        <Text style={[TYPE.displayBalance, styles.center, { color: color.paperInk }]}>SENRYO</Text>
        <Text style={[TYPE.displayBalance, styles.center, { color: color.paperInk }]}>SEND</Text>
      </View>
      <Text accessibilityRole="header" style={[TYPE.displayBalance, styles.center, { color: color.ink }]}>
        {"MOVE MONEY\nON MONAD"}
      </Text>
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
        {network} · Send tokens to a person or a wallet address.
      </Text>
      <View style={[styles.facts, { backgroundColor: color.card }]}>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>Your wallet and free trading balance</Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Review the exact recipient, amount, source and network fee before a passkey confirms. Submitted transfers stay
          in Activity while they settle.
        </Text>
      </View>
      <Button label="Continue" onPress={onContinue} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  body: { padding: SIZE.gutter, gap: SPACE.lg, flexGrow: 1, justifyContent: "center" },
  art: { minHeight: 180, justifyContent: "center", overflow: "hidden" },
  center: { textAlign: "center" },
  facts: { padding: SPACE.lg, gap: SPACE.sm },
});
