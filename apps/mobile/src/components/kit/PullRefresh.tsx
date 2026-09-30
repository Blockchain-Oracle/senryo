import { useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useCallback, useState } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";
import { fire } from "~/feedback/fire";
import { useTheme } from "~/theme";

/**
 * Pull to refresh (ported): one accent spinner and a `snap` as it arms, on every page. With no `onRefresh` it refetches
 * every query on screen, since the page is what the reader asked to be fresh. The spinner holds until the refetch
 * settles.
 */
export function usePullRefresh(onRefresh?: () => Promise<unknown> | undefined): ReactElement<RefreshControlProps> {
  const { color } = useTheme();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const run = useCallback(async () => {
    setRefreshing(true);
    fire("snap");
    try {
      await (onRefresh ? onRefresh() : client.invalidateQueries());
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, client]);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void run()}
      tintColor={color.primary}
      colors={[color.primary]}
      progressBackgroundColor={color.card}
    />
  );
}
