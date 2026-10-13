/**
 * The replay's images (Q3, D-350): the app's own views — the authentic market mark, the trader's portrait (the
 * chosen one, or the address's authored default for a guest) and the QR to the trade — drawn once off screen and
 * snapshotted into Skia images, so the video carries the same artwork as the app — the lockup too, drawn from its SVG
 * at the band's 325 × 88 (Skia's own SVG renderer ignored the size it was asked for).
 * Renders nothing visible; `onReady` fires once every image is taken.
 */

import { FILM_LAYOUT as L } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { makeImageFromView } from "@shopify/react-native-skia";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { QrCode } from "~/components/kit/QrCode";
import { SPACE } from "~/theme";
import { LOCKUP_SVG } from "~/theme/brand-svg";
import type { FilmImages } from "./drawFilm";

const HALF = 2;
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
  const lockup = useRef<View>(null);
  const done = useRef(onReady);
  done.current = onReady;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all([
        makeImageFromView(mark),
        makeImageFromView(portrait),
        makeImageFromView(qr),
        makeImageFromView(lockup),
      ])
        .catch(() => [null, null, null, null] as const)
        .then(([m, p, q, l]) => {
          if (live) done.current({ mark: m, portrait: p, qr: q, lockup: l });
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
      <View ref={mark} collapsable={false} style={square(L.market.mark)}>
        <EntityMark id={marketId(symbol)} size={L.market.mark} decorative />
      </View>
      <View ref={portrait} collapsable={false} style={square(L.portrait.size)}>
        <Avatar avatar={avatar} {...(address ? { address } : {})} size={L.portrait.size} />
      </View>
      <View ref={lockup} collapsable={false} style={{ width: L.lockup.w, height: L.lockup.h }}>
        <SvgXml xml={LOCKUP_SVG} width={L.lockup.w} height={L.lockup.h} />
      </View>
      <View ref={qr} collapsable={false} style={square(L.qr.size)}>
        <QrCode value={url} label="Trade link" size={L.qr.size - SPACE.sm * HALF} still />
      </View>
    </View>
  );
}

/** Each view snapshots at exactly its own square: never stretched to a wider sibling (the mark drew squashed). */
const square = (size: number) => ({ width: size, height: size });

const styles = StyleSheet.create({
  away: { position: "absolute", left: AWAY, top: 0, alignItems: "flex-start" },
});
