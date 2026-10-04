import { type ChainId, networkOf } from "@senryo/config";
import type { FeedItem } from "@senryo/query";
import { LIGHT } from "@senryo/tokens";
import { Asset } from "expo-asset";
import * as Files from "expo-file-system/legacy";
import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { STATUS_WORDS } from "./FeedRow";
import { receiptLines } from "./receipt-facts";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch] ?? ch,
  );

/** Exact facts for an exported receipt, including pending/failed status and the complete public identifiers. */
export function exportFacts(item: FeedItem, me: string, chainId: ChainId) {
  const network = networkOf(chainId);
  const lines = receiptLines(item, me).filter((line) => line.label !== "When");
  const counterparty =
    item.source.kind === "wallet"
      ? item.source.item.legs.find((leg) => leg.counterparty)?.counterparty
      : item.source.kind === "indexed"
        ? item.source.row.move?.counterparty
        : item.source.record.reviewedIntent.recipient;
  if (counterparty) {
    const line = lines.find((line) => ["To", "From", "Via"].includes(line.label));
    if (line) line.value = counterparty;
  }
  return [
    { label: "Status", value: item.status === "done" ? "Confirmed" : STATUS_WORDS[item.status] },
    { label: "Mode", value: network.key === "testnet" ? "Practice · paper funds" : "Mainnet · real funds" },
    { label: "Network", value: `${network.name} · ${chainId}` },
    { label: "Account", value: me },
    ...lines,
    { label: "Time (UTC)", value: new Date(item.at).toISOString() },
    ...item.hashes.map((hash) => ({ label: "Transaction", value: hash })),
    ...(item.source.kind === "journal" ? [{ label: "Operation", value: item.source.record.id }] : []),
  ];
}

export function receiptHtml(title: string, facts: Array<{ label: string; value: string }>, logo: string) {
  const rows = facts
    .map((line) => `<tr><th>${escapeHtml(line.label)}</th><td>${escapeHtml(line.value)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Helvetica,Arial,sans-serif;color:${LIGHT.foreground};padding:36px;font-size:13px}
    header{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${LIGHT.foreground};padding-bottom:20px}
    img{width:52px;height:52px;border-radius:12px}h1{font-size:24px;margin:0}h2{font-size:20px;margin:28px 0}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px 0;border-bottom:1px solid ${LIGHT.border}}
    th{width:120px;color:${LIGHT.text3};font-weight:normal}td{overflow-wrap:anywhere;word-break:break-word}footer{color:${LIGHT.text3};margin-top:28px;line-height:1.5}
    </style></head><body><header><img alt="Senryo" src="data:image/png;base64,${logo}"><div><h1>Senryo</h1>Transaction receipt</div></header>
    <h2>${escapeHtml(title)}</h2><table>${rows}</table><footer>This receipt records the known state at export. Pending, partial or failed operations are not proof of completed payment. Practice funds have no cash value.</footer></body></html>`;
}

/** Sharing offers Save to Files on iOS. Remove the app's temporary PDF after the share sheet finishes. */
export async function saveReceiptDocument(
  title: string,
  facts: Array<{ label: string; value: string }>,
): Promise<void> {
  if (!(await isAvailableAsync())) throw new Error("Receipt sharing is unavailable on this device");
  const logo = Asset.fromModule(require("../../../assets/images/icon.png"));
  await logo.downloadAsync();
  if (!logo.localUri) throw new Error("Couldn’t load the Senryo logo");
  const encoded = await Files.readAsStringAsync(logo.localUri, { encoding: Files.EncodingType.Base64 });
  const pdf = await printToFileAsync({ html: receiptHtml(title, facts, encoded) });
  const named = pdf.uri.replace(/([^/]+)$/, "Senryo-receipt-$1");
  try {
    await Files.moveAsync({ from: pdf.uri, to: named });
    await shareAsync(named, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Save Senryo receipt",
    });
  } finally {
    await Files.deleteAsync(pdf.uri, { idempotent: true });
    await Files.deleteAsync(named, { idempotent: true });
  }
}

export function saveReceipt(item: FeedItem, me: string, chainId: ChainId): Promise<void> {
  return saveReceiptDocument(item.title, exportFacts(item, me, chainId));
}
