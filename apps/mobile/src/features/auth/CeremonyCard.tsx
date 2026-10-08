/**
 * The in-flight ceremony: what is happening and what the system sheet is asking for — the pending-passkey art (the
 * Face ID glyph for an unlock), one title, one sentence, one spinner (Codex consult 1 Oct: no boxed waiting note, no list of steps that haven't happened yet).
 * When a provider asks twice on first setup (D-029) the sentence says so in place.
 */
import { NATIVE_ART } from "@senryo/identity/native";
import { Platform } from "react-native";
import { AuthCard } from "./AuthCard";

const PendingArt = NATIVE_ART["passkey-pending"]?.symbol;
/** The pending art (a key on a lacquer tablet) at this size in the ceremony sheet. */
const PENDING_ART = 132;

export type CeremonyKind = "create" | "sign-in" | "unlock" | "recover";

const TITLE: Record<CeremonyKind, string> = {
  create: "Creating your account",
  "sign-in": "Opening your account",
  unlock: "Unlocking your account",
  recover: "Opening with your backup passkey",
};

const SHEET_WORD = Platform.OS === "ios" ? "Face ID" : "your fingerprint or screen lock";

export function CeremonyCard({ kind, extraPrompt }: { kind: CeremonyKind; extraPrompt: boolean }) {
  return (
    <AuthCard
      glyph={kind === "unlock" ? "faceId" : "passkey"}
      {...(kind !== "unlock" && PendingArt
        ? { art: <PendingArt width={PENDING_ART} height={PENDING_ART} accessibilityElementsHidden /> }
        : {})}
      busy
      title={TITLE[kind]}
      body={
        extraPrompt
          ? "One more confirmation. Some passkey providers ask twice the first time: same passkey, same account."
          : `Confirm with ${SHEET_WORD}. Use the account’s passkey in the system prompt.`
      }
    />
  );
}
