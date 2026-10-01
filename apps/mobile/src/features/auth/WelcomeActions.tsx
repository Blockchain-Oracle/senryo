/**
 * Welcome actions (F01 / F02 / F03 / F08, D-029; Fomo F01's button stack): one 56 pt primary and two 44 pt quiet
 * controls under it. No hint → **Create account** (one passkey ceremony) is primary and "I have an account" runs the
 * discoverable sign-in; with a hint, continuing as that account is primary. "Browse markets" opens Markets without an
 * account. While a ceremony runs the primary shows its spinner and the rest wait; the ceremony and any failure are
 * the sheet over the story (`AuthFlowSheet`), never a card swapped in here.
 */
import { shortAddress } from "@senryo/core";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { LoadingState } from "~/components/kit/states";
import { ttftStart, ttftTap } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";
import type { AuthFlow } from "./useAuthFlow";

export function WelcomeActions({ flow }: { flow: AuthFlow }) {
  const { color } = useTheme();
  const account = useAccount();

  useEffect(() => {
    if (account.ready && !account.hint) ttftStart(Date.now());
  }, [account.ready, account.hint]);

  const lookAround = () => {
    storage.set(STORAGE_KEYS.welcomed, true);
    router.replace(ROUTES.markets);
  };

  if (!account.ready) return <LoadingState shape="line" label="Opening Senryo" />;
  const busy = flow.phase.kind === "running";
  const hint = account.hint;
  return (
    <View style={styles.actions}>
      {hint ? (
        <>
          <Button
            label={`Continue · ${shortAddress(hint.address)}`}
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            loading={busy}
            onPress={flow.unlock}
          />
          <View style={styles.row}>
            <Button
              label="Open Home, locked"
              variant="outline"
              size="sm"
              style={styles.flex}
              disabled={busy}
              onPress={() => router.replace(ROUTES.home)}
            />
            <Button
              label="Another account"
              variant="ghost"
              size="sm"
              style={styles.flex}
              disabled={busy}
              onPress={flow.signIn}
            />
          </View>
        </>
      ) : (
        <>
          <Button
            label="Create account"
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            loading={busy}
            onPress={() => {
              ttftTap();
              flow.create();
            }}
          />
          <View style={styles.row}>
            <Button
              label="I have an account"
              variant="outline"
              size="sm"
              style={styles.flex}
              disabled={busy}
              onPress={flow.signIn}
            />
            <Button
              label="Browse markets"
              variant="ghost"
              size="sm"
              style={styles.flex}
              disabled={busy}
              onPress={lookAround}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.md },
  row: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
});
