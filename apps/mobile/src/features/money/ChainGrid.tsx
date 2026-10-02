/**
 * The chain picker (B0.3, routes.md §3/§4; Solflare S24's chain sheet with real marks): only the chains this asset
 * has a route to (out) or from (in), each tile with the chain's mark, its name and the typical time with the route's
 * provider. A chain with no live provider stays, dimmed, with its reason. While Aurora has an open incident on Monad
 * its tiles are gone and one line says so; they return without a release. Ported from 21st.dev preetsuthar17/
 * selector-chips (#1963): a wrap of selectable tiles, the selected one raised.
 */
import type { BridgeRouteChain, BridgeRoutes } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, DISABLED_OPACITY, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SEC_PER_MIN = 60;
const PROVIDER_NAME: Record<string, string> = {
  cctp: "Circle CCTP",
  relay: "Relay",
  across: "Across",
  lifi: "LI.FI",
  aurora: "Aurora",
};

/** "~2 s", "~3 min". */
export function etaText(sec: number): string {
  return sec < SEC_PER_MIN ? `~${Math.max(1, sec)} s` : `~${Math.round(sec / SEC_PER_MIN)} min`;
}

export function providerName(provider: string): string {
  return PROVIDER_NAME[provider] ?? provider;
}

export function providerMark(provider: string): string {
  return ids.provider(provider);
}

function firstProvider(chain: BridgeRouteChain): string | undefined {
  return chain.providers.find((p) => p.available)?.provider;
}

export function ChainGrid({
  routes,
  selected,
  onPick,
  direction,
}: {
  routes: BridgeRoutes;
  selected?: number | undefined;
  onPick: (chain: BridgeRouteChain) => void;
  direction: "in" | "out";
}) {
  const { color } = useTheme();
  const auroraOff = routes.aurora.state === "incident";
  const chains = routes.chains.filter((c) => !(auroraOff && c.providers.every((p) => p.provider === "aurora")));
  return (
    <View style={styles.stack}>
      {auroraOff ? <Text style={[TYPE.rowDetail, { color: color.warn }]}>Aurora paused · using Relay</Text> : null}
      {chains.length === 0 ? (
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
          {direction === "out" ? "No route out for this token" : "No route in for this token"}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {chains.map((chain) => {
          const provider = firstProvider(chain);
          const reason = chain.available
            ? undefined
            : (chain.providers.find((p) => p.reason)?.reason ??
              `No route ${direction === "out" ? "to" : "from"} ${chain.name}`);
          const on = chain.chainId === selected;
          return (
            <Pressable
              key={chain.chainId}
              disabled={!chain.available}
              onPress={() => {
                fire("tick");
                onPick(chain);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !chain.available }}
              accessibilityLabel={`${chain.name}, ${reason ?? `${etaText(chain.etaSec)} with ${providerName(provider ?? "")}`}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: on ? color.selectedRow : pressed ? color.rowPressed : color.raised2,
                  opacity: chain.available ? 1 : DISABLED_OPACITY,
                },
              ]}
            >
              <EntityMark id={chain.mark} label={chain.name} size={SIZE.markToken} decorative />
              <View style={styles.text}>
                <Text
                  maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                  numberOfLines={1}
                  style={[TYPE.rowStrong, { color: color.ink }]}
                >
                  {chain.name}
                </Text>
                <Text
                  maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                  numberOfLines={1}
                  style={[TYPE.meta, { color: color.text3 }]}
                >
                  {reason ?? `${etaText(chain.etaSec)} · ${providerName(provider ?? "")}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  center: { textAlign: "center", paddingVertical: SPACE.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: SHEET_SHAPE.rowRadius - SPACE.xs,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
