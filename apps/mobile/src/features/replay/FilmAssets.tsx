/**
 * The replay video's images (Q3, D-350): the app's own views — the authentic market mark, the trader's portrait (the
 * chosen one, or the address's authored default for a guest) and the QR to the trade — drawn once off screen and
 * snapshotted into Skia images, so the video carries the same artwork as the app; the lockup is parsed from its SVG.
 * Renders nothing visible; `onReady` fires once every image is taken.
 */
import { marketId } from "@senryo/identity";
import { makeImageFromView, Skia } from "@shopify/react-native-skia";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { QrCode } from "~/components/kit/QrCode";
import { LOCKUP_SVG } from "~/theme/brand-svg";
import type { FilmImages } from "./drawFilm";
import { LAYOUT as L } from "./film-layout";

/** Off screen: laid out and drawable, never seen. */
const AWAY = -10_000;
/** Snapshot after the views have painted. */
const PAINT_MS = 120;

export function FilmAssets({
  symbol,
  avatar,
  address,
  url,
  onReady,
}: {
  symbol: string;
  avatar: string | null;
  address: string | undefined;
  url: string;
  onReady: (images: FilmImages) => void;
}) {
  const mark = useRef<View>(null);
  const portrait = useRef<View>(null);
  const qr = useRef<View>(null);
  const done = useRef(onReady);
  done.current = onReady;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all([makeImageFromView(mark), makeImageFromView(portrait), makeImageFromView(qr)])
        .catch(() => [null, null, null] as const)
        .then(([m, p, q]) => {
          if (live) done.current({ mark: m, portrait: p, qr: q, lockup: Skia.SVG.MakeFromString(LOCKUP_SVG) });
        });
    }, PAINT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <View
      style={styles.away}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View ref={mark} collapsable={false}>
        <EntityMark id={marketId(symbol)} size={L.market.mark} decorative />
      </View>
      <View ref={portrait} collapsable={false}>
        <Avatar avatar={avatar} {...(address ? { address } : {})} size={L.portrait.size} />
      </View>
      <View ref={qr} collapsable={false}>
        <QrCode value={url} label="Trade link" size={L.qr.size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  away: { position: "absolute", left: AWAY, top: 0 },
});
