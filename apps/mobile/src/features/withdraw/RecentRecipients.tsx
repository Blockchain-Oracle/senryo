/**
 * Recent sends (FT058, Phantom P22): while the recipient field is empty, the people this account last sent to on
 * this network — their portrait, address, what was sent and when — and a tap fills the field. With none, one quiet
 * line says how to start (P22's "No recent sends"). Read from the account's indexed sends, so it follows the account.
 */
import type { Address } from "@senryo/core";
import { useRecentRecipients } from "@senryo/query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SectionLabel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { ageLabel } from "~/features/markets/session";
import { useNowSec } from "~/features/markets/useNowSec";
import { TraderAvatar } from "~/features/social/TraderAvatar";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function RecentRecipients({ address, onPick }: { address: Address; onPick: (to: string) => void }) {
  const { color } = useTheme();
  const recents = useRecentRecipients(address);
  const now = useNowSec();
  return (
    <View>
      <SectionLabel style={styles.label}>Recent</SectionLabel>
      <ReadingView reading={recents} loading="list" loadingLabel="Reading your recent sends">
        {(list) =>
          list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[TYPE.rowTitle, { color: color.ink }]}>No recent sends</Text>
              <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
                Type an @username or paste a Monad address above.
              </Text>
            </View>
          ) : (
            <View>
              {list.map((r) => (
                <Pressable
                  key={r.address}
                  onPress={() => {
                    fire("tick");
                    onPick(r.address);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Send to ${shortAddress(r.address)} again`}
                  style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
                >
                  <TraderAvatar trader={{ address: r.address, handle: null, displayName: null }} size={SIZE.avatarMd} />
                  <View style={styles.text}>
                    <Text style={[TYPE.rowTitle, { color: color.ink }]}>{shortAddress(r.address)}</Text>
                    <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
                      Last sent {usd(r.lastAmountUsd6)}
                      {r.symbol ? ` ${r.symbol}` : ""} · {ageLabel(BigInt(r.lastAt), now)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        }
      </ReadingView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { paddingBottom: SPACE.xs },
  empty: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.xl },
  center: { textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
