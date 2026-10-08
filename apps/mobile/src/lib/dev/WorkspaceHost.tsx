import { useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { closeMenu, registerDevMenuItems } from "expo-dev-client";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { oweSetup } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DOCK, dockBottom, SPACE, TYPE, useTheme } from "~/theme";
import { resetDevProfile } from "./api";
import { DEV_WORKSPACE, devControl } from "./config";

export function WorkspaceHost() {
  if (!DEV_WORKSPACE) return null;
  return <WorkspaceControls />;
}

function WorkspaceControls() {
  const { color } = useTheme();
  const pathname = usePathname();
  const hideBadge =
    pathname === "/welcome" ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/recover");
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const queries = useQueryClient();
  const env = useQueryEnv();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    void registerDevMenuItems([{ name: "Senryo workspace", callback: () => setOpen(true), shouldCollapse: true }]);
    if (account.ready) closeMenu();
  }, [account.ready]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await queries.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Development control failed");
    } finally {
      setBusy(false);
    }
  };
  const go = (href: typeof ROUTES.home | typeof ROUTES.markets | typeof ROUTES.you | typeof ROUTES.welcome) => {
    setOpen(false);
    router.navigate(href);
  };
  return (
    <>
      {!hideBadge ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open development workspace controls"
          onPress={() => setOpen(true)}
          style={[
            styles.badge,
            { bottom: dockBottom(insets.bottom) + DOCK.height + SPACE.sm, backgroundColor: color.ink },
          ]}
        >
          <Text style={[TYPE.meta, { color: color.ground }]}>DEV · Local fork</Text>
        </Pressable>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.scrim, { backgroundColor: color.scrim }]}>
          <View style={[styles.panel, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.lg }]}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Development workspace</Text>
              <Text style={[TYPE.body, { color: color.text2 }]}>
                Actual app screens and contracts on a local Practice fork. Controlled prices, local profile, no real
                funds. Local weekly sessions stay open for after-hours iteration. Passkey and Face ID ceremonies are
                bypassed here.
              </Text>
              <Text style={[TYPE.meta, { color: color.text2 }]}>
                {!account.ready
                  ? "Preparing account…"
                  : account.hint
                    ? "Account ready · 75 P$ in trading, 25 P$ in wallet · test AUSD for crypto"
                    : "Fork unavailable. Start the local controller and retry."}
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={[TYPE.body, { color: color.warn }]}>
                  {error}
                </Text>
              ) : null}
              <Button label="Dashboard" onPress={() => go(ROUTES.home)} disabled={busy} />
              <Button label="Markets · long and short" onPress={() => go(ROUTES.markets)} disabled={busy} />
              <Button label="Profile" variant="secondary" onPress={() => go(ROUTES.you)} disabled={busy} />
              <Button
                label="Gold price +1%"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(() => devControl("price", { marketId: 0, bps: 100 }))}
              />
              <Button
                label="Gold price −1%"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(() => devControl("price", { marketId: 0, bps: -100 }))}
              />
              <Button
                label="ZEC price +0.25%"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(() => devControl("perpl-price", { marketId: 256, bps: 25 }))}
              />
              <Button
                label="ZEC price −0.25%"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(() => devControl("perpl-price", { marketId: 256, bps: -25 }))}
              />
              <Button
                label={frozen ? "Resume oracle updates" : "Pause oracle updates · test stale state"}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await devControl("freeze", { frozen: !frozen });
                    setFrozen(!frozen);
                  })
                }
              />
              <Button label="Preview welcome" variant="secondary" disabled={busy} onPress={() => go(ROUTES.welcome)} />
              <Button
                label="Replay onboarding"
                variant="secondary"
                disabled={busy || !account.hint}
                onPress={() => {
                  if (!account.hint) return;
                  oweSetup(account.hint.address);
                  setOpen(false);
                  router.push("/setup/handle");
                }}
              />
              <Button
                label="Reset balances and positions"
                variant="secondary"
                disabled={busy || !account.hint}
                onPress={() =>
                  void run(async () => {
                    await devControl("reset", { address: account.hint?.address });
                    env.perplPrices.reset();
                    storage.clearAll();
                    resetDevProfile();
                    storage.set(STORAGE_KEYS.welcomed, true);
                    setFrozen(false);
                    go(ROUTES.home);
                  })
                }
              />
              <Button
                label="Retry workspace"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(account.refresh)}
              />
              <Button label="Close controls" variant="ghost" onPress={() => setOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: SPACE.md,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
    zIndex: 100,
  },
  scrim: { flex: 1, justifyContent: "flex-end" },
  panel: { maxHeight: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { padding: SPACE.lg, gap: SPACE.md },
});
