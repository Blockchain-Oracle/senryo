import { journalItem, readOperation, subscribeOperations } from "@senryo/query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { LoadingState } from "~/components/kit/states";
import { useIndexedReceipt } from "~/features/activity/useIndexedReceipt";
import { FEED_FORMAT } from "~/features/activity/feed-format";
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
  const { op, event } = useLocalSearchParams<{ op?: string; event?: string }>();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const [, setRevision] = useState(0);
  useEffect(() => subscribeOperations(() => setRevision((r) => r + 1)), []);
  const indexed = useIndexedReceipt(event, address);
  const record = op ? readOperation(op) : undefined;
  const mine = record && address && record.account === address.toLowerCase() && record.chainId === network.chainId;
  const item = event ? indexed.data : mine && address ? journalItem(record, address, FEED_FORMAT) : undefined;
  return (
    <SheetRoute title={item?.title ?? "Receipt"}>
      {item && address ? (
        <ReceiptBody item={item} me={address} chainId={network.chainId} />
      ) : event && indexed.isLoading ? (
        <LoadingState shape="list" label="Loading transaction" />
      ) : (
        <QuietLine {...(indexed.isError ? { action: { label: "Retry", onPress: () => void indexed.refetch() } } : {})}>
          {event ? indexed.isError ? "Couldn’t load this transaction" : "Transaction unavailable for this account" : "Not on this phone"}
        </QuietLine>
      )}
    </SheetRoute>
  );
}
