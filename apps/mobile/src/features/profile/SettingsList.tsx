/**
 * Settings (A10; §0.9 "Settings"): one plain grouped list in the iOS Settings grammar — Account (Wallet & address,
 * Security, Recovery, Mode), Preferences (Appearance, Sounds & haptics, Notifications, Hide balances,
 * Replay welcome), About (Status, Help, Terms, Privacy), then Delete my data and Sign out (confirmed). A guest sees
 * Preferences and About. The version sits under it all; a long-press on it opens Diagnostics. Browsing here never
 * asks for Face ID; the pages that loosen something keep their own step-up.
 */
import { shortAddress } from "@senryo/core";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { Panel } from "~/components/kit/Surface";
import {
  ArrowLeftRight,
  Bell,
  Eye,
  History,
  KeyRound,
  Lifebuoy,
  Lock,
  QrCode,
  ScrollText,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Volume,
} from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { APP } from "~/lib/constants/app";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { useHideBalances } from "~/lib/hide-balances";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { SectionHeading } from "./SectionHeading";
import { SettingsRow } from "./SettingsRow";
import { SignOutConfirm } from "./SignOutConfirm";

const MS_PER_MINUTE = 60_000;
/** New installs start light (the theme provider): an unset preference reads Light, as the picker shows it. */
const APPEARANCE: Record<string, string> = { dark: "Dark", light: "Light", system: "System" };

const open = (href: string) => router.push(href as Href);

export function SettingsList() {
  const { color } = useTheme();
  const account = useAccount();
  const network = useNetwork();
  const [theme] = useMMKVString(STORAGE_KEYS.theme, storage);
  const [sounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const [hidden, setHidden] = useHideBalances();
  const [signingOut, setSigningOut] = useState(false);
  const hint = account.hint;
  const practice = network.key === "testnet";
  const sound = (sounds ?? true) || (haptics ?? true) ? "On" : "Off";
  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  return (
    <>
      {hint ? (
        <View style={styles.group}>
          <SectionHeading>Account</SectionHeading>
          <Panel>
            <SettingsRow
              title="Wallet & address"
              icon={QrCode}
              tint={color.primary}
              value={shortAddress(hint.address)}
              onPress={() => open(ROUTES.accountIdentity)}
            />
            <SettingsRow
              title="Security"
              icon={ShieldCheck}
              tint={color.up}
              value={`${account.settings.ttlMs / MS_PER_MINUTE} min`}
              onPress={() => open(ROUTES.accountSecurity)}
            />
            <SettingsRow
              title="Recovery"
              icon={KeyRound}
              tint={color.warn}
              onPress={() => open(ROUTES.accountRecovery)}
            />
            <SettingsRow
              title="Mode"
              icon={ArrowLeftRight}
              tint={practice ? color.practice : color.mainnet}
              value={network.modeLabel}
              onPress={() => open(ROUTES.accountMode)}
            />
          </Panel>
        </View>
      ) : (
        // A guest's way in (R2.15): the account rows appear once there is one.
        <View style={styles.group}>
          <SectionHeading>Account</SectionHeading>
          <Panel>
            <SettingsRow
              title="Create account or sign in"
              icon={QrCode}
              tint={color.primary}
              onPress={() => open(accountRequiredRoute("make a call", ROUTES.accountSettings))}
            />
          </Panel>
        </View>
      )}
      <View style={styles.group}>
        <SectionHeading>Preferences</SectionHeading>
        <Panel>
          <SettingsRow
            title="Appearance"
            icon={SlidersHorizontal}
            tint={color.chart2}
            value={APPEARANCE[theme ?? "light"] ?? "Light"}
            onPress={() => open(ROUTES.accountPreferences)}
          />
          <SettingsRow
            title="Sounds & haptics"
            icon={Volume}
            tint={color.chart4}
            value={sound}
            onPress={() => open(ROUTES.accountPreferences)}
          />
          <SettingsRow
            title="Notifications"
            icon={Bell}
            tint={color.down}
            onPress={() => open(ROUTES.accountNotifications)}
          />
          <SettingsRow
            title="Hide balances"
            icon={Eye}
            tint={color.chart3}
            control={
              <Switch
                {...switchColors}
                value={hidden}
                onValueChange={(next) => {
                  fire("tick");
                  setHidden(next);
                }}
                accessibilityLabel="Hide balances"
              />
            }
          />
          <SettingsRow
            title="Replay welcome"
            icon={History}
            tint={color.practice}
            onPress={() => open(ROUTES.welcome)}
          />
        </Panel>
      </View>
      <View style={styles.group}>
        <SectionHeading>About</SectionHeading>
        <Panel>
          <SettingsRow title="Status" icon={Signal} tint={color.up} onPress={() => open(ROUTES.status)} />
          <SettingsRow title="Help" icon={Lifebuoy} tint={color.primary} onPress={() => open(ROUTES.accountHelp)} />
          <SettingsRow
            title="Terms"
            icon={ScrollText}
            tint={color.chartNeutral}
            onPress={() => open(ROUTES.accountTerms)}
          />
          <SettingsRow title="Privacy" icon={Lock} tint={color.mainnet} onPress={() => open(ROUTES.accountPrivacy)} />
        </Panel>
      </View>
      {hint ? (
        <Panel>
          <SettingsRow title="Delete my data" destructive onPress={() => open(ROUTES.accountDeleteData)} />
          <SettingsRow title="Sign out" destructive onPress={() => setSigningOut(true)} />
        </Panel>
      ) : null}
      <Pressable
        onLongPress={() => {
          fire("tick");
          open(ROUTES.accountDiagnostics);
        }}
        accessibilityRole="text"
        accessibilityHint="Long-press for diagnostics"
        accessibilityActions={[{ name: "longpress", label: "Diagnostics" }]}
        onAccessibilityAction={() => open(ROUTES.accountDiagnostics)}
        style={styles.version}
      >
        <Text style={[TYPE.meta, { color: color.text3 }]}>
          {APP.name} {APP.version}
        </Text>
      </Pressable>
      {signingOut ? <SignOutConfirm onClose={() => setSigningOut(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: SPACE.md },
  version: { alignItems: "center", paddingVertical: SPACE.md },
});
