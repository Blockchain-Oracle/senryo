import { requireReviewedFee, withReviewedNetworkFee } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { MoneyOperation, PlannedStep } from "./useMoneyOperation";

/** Fee facts and executable steps become one completed review; confirmation never prepares/refetches. */
export function useReviewedFee(
  op: MoneyOperation | undefined,
  preparing: boolean,
  practice: boolean,
  estimate: (steps: readonly PlannedStep[]) => Promise<{ fee: string; bounds: bigint[] }>,
) {
  const instance = useId();
  const id = op?.reviewedIntent.reviewId;
  const query = useQuery({
    queryKey: ["money-reviewed-fee", instance, id ?? "none"],
    enabled: op !== undefined && !preparing,
    queryFn: async () => {
      if (!op || !id) throw new Error("Review again");
      const facts = practice ? { fee: "Sponsored", bounds: [] } : await estimate(op.steps);
      const fee = facts.fee;
      await op.revalidate(0);
      return {
        id,
        fee,
        prepared: op,
        op: withReviewedNetworkFee(op, fee, practice ? undefined : facts.bounds),
      };
    },
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const pending = preparing || query.isFetching;
  const ready =
    !pending && query.isSuccess && query.data.id === id && query.data.prepared === op ? query.data : undefined;
  return {
    fee: ready?.fee,
    block: query.isError ? "Couldn’t estimate the complete network fee. Review again." : undefined,
    busy: preparing || (op !== undefined && !ready && !query.isError),
    require: () => {
      requireReviewedFee(id, ready, pending || !query.isSuccess);
      if (!ready) throw new Error("Wait for the complete network fee, then review again.");
      return ready.op;
    },
  };
}
