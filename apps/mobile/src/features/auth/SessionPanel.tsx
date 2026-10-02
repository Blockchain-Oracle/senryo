/**
 * The trading session as rows (A4; Home no longer carries the session chip, so this lives in Settings → Security and
 * in the session sheet): who is signed in, "Unlocked · locks 14:32" or "Locked", then Unlock with Face ID or Lock now,
 * and "Use another account" (A5, asked first by the caller). A failed unlock says why in one line.
 */
import { type AuthFailure, authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { UNLOCK_WORD, useChip } from "~/lib/account/use-chip";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { accountName, useAccountIdentity } from "./SignInOutcome";

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function SessionPanel({ onSwitch }: { onSwitch: () => void }) {
  const { color } = useTheme();
  const account = useAccount();
  const chip = useChip();
  const address = account.hint?.address;
  const { handle, avatar } = useAccountIdentity(address);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure>();
  const snapshot = account.snapshot;
  const unlocked = snapshot.status === "unlocked";
  const state = unlocked
    ? chip.tone === "warning"
      ? chip.label
      : `Unlocked · locks ${clock(snapshot.expiresAt)}`
    : "Locked";

  const unlock = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      await account.unlock();
      fire("confirm", { sound: "unlock" });
    } catch (error) {
      const kind = classifyAuthError(error);
      if (!isSilent(kind)) {
        fire("fail");
        setFailure(kind);
      }
    } finally {
      setBusy(false);
    }
  };
  const copy = failure ? authFailureCopy(failure, Platform.OS === "ios" ? "ios" : "android") : undefined;
  if (!address) return null;
  return (
    <View style={styles.wrap}>
      <Panel style={styles.who}>
        <Avatar avatar={avatar} address={address} size={SIZE.avatarMd} />
        <View style={styles.text}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
            {accountName(handle, address)}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: unlocked ? color.up : color.text3 }]}>
            {state}
          </Text>
        </View>
      </Panel>
      {copy ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {copy.title}
        </Text>
      ) : null}
      {unlocked ? (
        <Button
          label="Lock now"
          variant="secondary"
          onPress={() => {
            fire("tick");
            account.lock();
          }}
        />
      ) : (
        <Button label={`Unlock with ${UNLOCK_WORD}`} loading={busy} onPress={() => void unlock()} />
      )}
      <Button label="Use another account" variant="ghost" size="sm" disabled={busy} onPress={onSwitch} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  who: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.lg },
  text: { flex: 1, gap: SPACE.xxs },
  center: { textAlign: "center" },
});
