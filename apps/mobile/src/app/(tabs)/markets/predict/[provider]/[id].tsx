import { predictionProviderSchema } from "@senryo/api-client";
import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "~/components/kit/states";
import { PredictionDetail } from "~/features/predictions/PredictionDetail";

export default function Page() {
  const { provider, id } = useLocalSearchParams<{ provider: string; id: string }>();
  const parsed = predictionProviderSchema.safeParse(provider);
  if (!parsed.success || !/^\d{1,30}$/.test(id ?? "")) return <EmptyState why="This prediction link is unavailable" />;
  return <PredictionDetail provider={parsed.data} id={id} />;
}
