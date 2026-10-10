import { WELCOME } from "@senryo/tokens";

/** Scene roles used on the source's black account header and magenta context anchor. */
export const NATIVE_SCENE = {
  welcomeSky: WELCOME.sky,
  welcomeInk: WELCOME.ink,
  welcomeShade: "#00253D",
  welcomeTrack: "#FFFFFF66",
  account: "#000000",
  onAccount: "#FFFFFF",
  accountMuted: "#B8B8B8",
  action: "#FA00FF",
  actionInk: "#000000",
  glow: "#FA00FF66",
} as const;
