/**
 * The six story scenes (J1; direction §12 "one balance, passkeys, commodities/FX/crypto, LP liquidity, Kinpaku and
 * Practice↔Mainnet"; review 1 Oct §4). Each scene is authored artwork in layers (brand/art/onboarding, rasterised by
 * `scripts/onboarding-art.mjs`) plus one headline and one sentence. The copy states only what the product does today:
 * no returns, no rates, no promise about where a card works or how passkeys sync.
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
    key: "balance",
    title: "One balance. More possibilities.",
    body: "See what is free to trade and free to spend, from one account.",
    art: "A lacquer money chest with a gold koban and the Kinpaku card.",
    field: require("../../../assets/onboarding/scene-balance-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-balance-shadow.webp"),
      back: require("../../../assets/onboarding/scene-balance-back.webp"),
      main: require("../../../assets/onboarding/scene-balance-main.webp"),
      fore: require("../../../assets/onboarding/scene-balance-fore.webp"),
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
    key: "markets",
    title: "Explore beyond one market.",
    body: "Gold, silver, currencies and crypto. What you can trade depends on the market and the mode.",
    art: "A gold koban and a silver chōgin on a tray, with Bitcoin, Monad and currency pair marks.",
    field: require("../../../assets/onboarding/scene-markets-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-markets-shadow.webp"),
      main: require("../../../assets/onboarding/scene-markets-main.webp"),
    },
    labels: LABELS.scenes.markets as readonly SceneLabel[],
  },
  {
    key: "lp",
    title: "Explore the liquidity pool.",
    body: "See how the pool works, and its risks, before you add money.",
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
    key: "kinpaku",
    title: "Meet Kinpaku.",
    body: "A card that spends only what your positions don’t need. It is in preview.",
    art: "A black lacquer card half covered in gold leaf, beside a book of gold leaf.",
    field: require("../../../assets/onboarding/scene-kinpaku-field.webp"),
    layers: {
      shadow: require("../../../assets/onboarding/scene-kinpaku-shadow.webp"),
      back: require("../../../assets/onboarding/scene-kinpaku-back.webp"),
      main: require("../../../assets/onboarding/scene-kinpaku-main.webp"),
      fore: require("../../../assets/onboarding/scene-kinpaku-fore.webp"),
    },
  },
  {
    key: "modes",
    title: "Start with paper money.",
    body: "Practice first. Mainnet uses real money.",
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
