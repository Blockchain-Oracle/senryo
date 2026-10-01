/**
 * Reading the clipboard. iOS asks "Allow Paste?" for it, and the app is `inactive` under that prompt like under any
 * system sheet; counting the read as a prompt of ours keeps the privacy plate down behind it (system-prompt.ts).
 */
import * as Clipboard from "expo-clipboard";
import { countingPrompts } from "./account/system-prompt";

const clipboard = countingPrompts({ read: () => Clipboard.getStringAsync() });

/** The clipboard's text, trimmed. */
export async function readClipboard(): Promise<string> {
  return (await clipboard.read()).trim();
}
