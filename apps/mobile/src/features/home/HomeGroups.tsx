/** Slush's account/investment disclosure, using exactly the parts of Home's owning balance sheet. */
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ChevronDown, Coins, type SymbolIcon, Wallet } from "~/components/kit/symbols";
import { useBalanceSheet } from "~/features/portfolio/useBalanceSheet";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { usd } from "~/lib/money";
import { EASE, RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { EarnTab, HomeTabs } from "./HomeTabs";

const MARKS_SHOWN = 3;
const OPEN_ROTATION = 180;

export function HomeGroups() {
  const sheet = useBalanceSheet();
  const [hidden] = useHideBalances();
  const accounts = sheet.rows.filter((row) => row.key !== "earn");
  const known = sheet.status === "ready" && accounts.some((row) => row.valueUsd6 !== undefined);
  const total = accounts.reduce((sum, row) => sum + (row.valueUsd6 ?? 0n), 0n);
  const earn = sheet.rows.find((row) => row.key === "earn");
  const marks = [...new Set(accounts.flatMap((row) => row.marks).filter(Boolean))].slice(0, MARKS_SHOWN);
  const amount = (value: bigint, partial = false) =>
    `${partial && !hidden ? "≈ " : ""}${masked(usd(value, 2, "mainnet"), hidden)}`;
  return (
    <View style={styles.groups}>
      <Group
        title="Accounts"
        value={known ? amount(total, sheet.partial) : "—"}
        icon={Wallet}
        marks={marks}
        initiallyOpen
      >
        <HomeTabs />
      </Group>
      <Group
        title="Investments"
        value={earn?.valueUsd6 !== undefined ? amount(earn.valueUsd6) : undefined}
        icon={Coins}
      >
        <EarnTab />
      </Group>
    </View>
  );
}

function Group({
  title,
  value,
  icon: Icon,
  marks = [],
  initiallyOpen = false,
  children,
}: {
  title: string;
  value: string | undefined;
  icon: SymbolIcon;
  marks?: string[];
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const reduce = useReducedMotion();
  const rotation = useSharedValue(open ? OPEN_ROTATION : 0);
  useEffect(() => {
    rotation.value = reduce
      ? open
        ? OPEN_ROTATION
        : 0
      : withTiming(open ? OPEN_ROTATION : 0, { duration: TIMING.selection, easing: EASE });
  }, [open, reduce, rotation]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View
      {...(reduce ? {} : { layout: LinearTransition.duration(TIMING.selection) })}
      style={[styles.group, { backgroundColor: color.card }]}
    >
      <Pressable
        onPress={() => {
          fire("tick");
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}${value ? `, ${value}` : ""}`}
        accessibilityState={{ expanded: open }}
        style={styles.heading}
      >
        <View style={styles.title}>
          <Icon size={SIZE.icon} color={color.text2} />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{title}</Text>
        </View>
        <View style={styles.trailing}>
          {!open && marks.length > 0 ? <MarkCluster ids={marks} size={SIZE.iconSm} ground={color.card} /> : null}
          {value ? <Text style={[TYPE.rowAmount, { color: color.ink }]}>{value}</Text> : null}
          <Animated.View style={chevron}>
            <ChevronDown size={SIZE.iconSm} color={color.text3} />
          </Animated.View>
        </View>
      </Pressable>
      {open ? (
        <Animated.View {...(reduce ? {} : { entering: FadeIn.duration(TIMING.selection) })} style={styles.content}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: SPACE.sm },
  group: { borderRadius: RADIUS.lg, overflow: "hidden" },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
    minHeight: SIZE.rowMinHeight,
    padding: SPACE.md,
  },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  trailing: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  content: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.md },
});
