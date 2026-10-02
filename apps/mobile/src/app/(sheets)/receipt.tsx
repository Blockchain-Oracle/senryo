import { readOperation, subscribeOperations } from "@senryo/query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { journalItem } from "~/features/activity/feed";
import { ReceiptBody } from "~/features/activity/Receipt";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";

/**
 * The receipt of one operation from this phone's journal (B12; `receiptRoute(id)`, e.g. an outcome's "View receipt"
 * or a push tap): the same body as an Activity row's receipt, following the operation as it settles. An operation
 * that isn't on this phone (or belongs to another account) says so instead of guessing.
 */
export default function ReceiptSheet() {
  const { op } = useLocalSearchParams<{ op?: string }>();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const [, setRevision] = useState(0);
  useEffect(() => subscribeOperations(() => setRevision((r) => r + 1)), []);
  const record = op ? readOperation(op) : undefined;
  const mine = record && address && record.account === address.toLowerCase() && record.chainId === network.chainId;
  const item = mine && address ? journalItem(record, address) : undefined;
  return (
    <SheetRoute title={item?.title ?? "Receipt"}>
      {item && address ? (
        <ReceiptBody item={item} me={address} chainId={network.chainId} />
      ) : (
        <QuietLine>Not on this phone</QuietLine>
      )}
    </SheetRoute>
  );
}
