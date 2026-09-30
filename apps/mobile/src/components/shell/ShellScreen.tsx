import { router, Stack } from "expo-router";
import type { ReactNode } from "react";
import { Screen } from "~/components/kit/Screen";
import { EmptyState } from "~/components/kit/states";

/**
 * A route that exists (deep links, navigation, headers) but whose feature lands later. It says so plainly — why it is
 * empty and where to go instead — rather than rendering invented content.
 */
export function ShellScreen({
  title,
  why,
  detail,
  back = true,
  children,
}: {
  title: string;
  why: string;
  detail: string;
  back?: boolean;
  children?: ReactNode;
}) {
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {children}
      <EmptyState
        why={why}
        detail={detail}
        {...(back ? { action: { label: "Go back", onPress: () => router.back() } } : {})}
      />
    </Screen>
  );
}
