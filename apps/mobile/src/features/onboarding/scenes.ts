/**
 * The story scenes (J1, reworded for the prediction market, pivot S5.7): the passkey, the pool on the other side of
 * every call, and Practice first. The card, the money chest (it shows the card) and the gold/FX market scenes left with
 * the pivot. Five scenes: the call, the payout, the passkey, the pool and the two modes. Each is authored artwork in
 * layers (brand/art/onboarding, rasterised by `scripts/onboarding-art.mjs`) plus one headline and one sentence. The
 * copy states only what the product does today: no returns, no rates, no promise about how passkeys sync.
 */
import type { ImageSourcePropType } from "react-native";
import LABELS from "../../../assets/onboarding/labels.json";

/** Back-to-front. `depth` is how far a layer travels relative to the hero when scenes change (1 = with the page). */
export type SceneLayerName = "shadow" | "back" | "main" | "fore";

export const LAYER_DEPTH: Readonly<Record<SceneLayerName, number>> = { shadow: 1, back: 0.8, main: 1, fore: 1.3 };
export const LAYER_ORDER: readonly SceneLayerName[] = ["shadow", "back", "main", "fore"];

/**
 * Text the artwork leaves blank for the app to draw (a pair's name, a mode's name): its box in the master's own
 * units, the theme role of its ink, and the layer its plate is on, so the text travels with the plate.
 */
export interface SceneLabel {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ink: "paperInk" | "paperPractice" | "paperMainnet";
  layer: SceneLayerName;
}

/** The masters' drawing size; the hero covers its stage with it. */
export const ART_SIZE = { width: LABELS.viewBox[0] ?? 1, height: LABELS.viewBox[1] ?? 1 } as const;

export interface Scene {
  key: string;
  title: string;
  body: string;
  /** What the artwork shows, for VoiceOver (the picture is not decoration: it carries the scene). */
  art: string;
  /** The colour field: crossfades between scenes instead of travelling. */
  field: ImageSourcePropType;
  layers: Partial<Record<SceneLayerName, ImageSourcePropType>>;
  labels?: readonly SceneLabel[];
}

export const SCENES: readonly Scene[] = [
  {
    key: "call",
    title: "Call the next move.",
    body: "Up or Down on a live price, in dollars. Cash out any time before the close.",
    art: "A gold line climbing past a dashed line on a lacquer tablet, with an Up dish and a Down dish beside it.",
    field: require("../../../assets/onboarding/scene-call-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-call-shadow.webp"),
      back: require("../../../assets/onboarding/scene-call-back.webp"),
      main: require("../../../assets/onboarding/scene-call-main.webp"),
      fore: require("../../../assets/onboarding/scene-call-fore.webp"),
    },
  },
  {
    key: "payout",
    title: "Payouts land on their own.",
    body: "When the window closes, a winning call is paid straight to your balance. Nothing to claim.",
    art: "Gold koban falling into the lacquer senryō-bako chest.",
    field: require("../../../assets/onboarding/scene-payout-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-payout-shadow.webp"),
      back: require("../../../assets/onboarding/scene-payout-back.webp"),
      main: require("../../../assets/onboarding/scene-payout-main.webp"),
      fore: require("../../../assets/onboarding/scene-payout-fore.webp"),
    },
  },
  {
    key: "passkey",
    title: "Your account, with a passkey.",
    body: "Your phone creates it and unlocks it. There is no password to remember.",
    art: "A key resting on a lacquer tablet beside a phone.",
    field: require("../../../assets/onboarding/scene-passkey-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-passkey-shadow.webp"),
      back: require("../../../assets/onboarding/scene-passkey-back.webp"),
      main: require("../../../assets/onboarding/scene-passkey-main.webp"),
      fore: require("../../../assets/onboarding/scene-passkey-fore.webp"),
    },
  },
  {
    key: "lp",
    title: "One pool takes the other side.",
    body: "A shared pool takes the other side of every call and pays the winners.",
    art: "A lacquer basin holding one shared pool, its lid open beside it.",
    field: require("../../../assets/onboarding/scene-lp-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-lp-shadow.webp"),
      back: require("../../../assets/onboarding/scene-lp-back.webp"),
      main: require("../../../assets/onboarding/scene-lp-main.webp"),
      fore: require("../../../assets/onboarding/scene-lp-fore.webp"),
    },
  },
  {
    key: "modes",
    title: "Start with test dollars.",
    body: "Practice is free. Real money starts only when you switch to Real.",
    art: "Paper practice notes in front, with a gold koban set apart on its own dish.",
    field: require("../../../assets/onboarding/scene-modes-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-modes-shadow.webp"),
      back: require("../../../assets/onboarding/scene-modes-back.webp"),
      main: require("../../../assets/onboarding/scene-modes-main.webp"),
      fore: require("../../../assets/onboarding/scene-modes-fore.webp"),
    },
    labels: LABELS.scenes.modes as readonly SceneLabel[],
  },
];
