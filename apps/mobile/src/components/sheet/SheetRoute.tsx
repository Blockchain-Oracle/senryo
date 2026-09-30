import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { TYPE, useTheme } from "~/theme";
import { Sheet, useSheetClose } from "./Sheet";

/** A sheet route (transparent modal) with the standard title/body layout; `router.back()` once it has slid away. */
export function SheetRoute({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  const { color } = useTheme();
  return (
    <Sheet onClose={() => router.back()} closeLabel={`Close ${title}`}>
      <Text accessibilityRole="header" style={[TYPE.title, { color: color.ink }]}>
        {title}
      </Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{body}</Text>
      {children}
      <CloseButton />
    </Sheet>
  );
}

function CloseButton() {
  const close = useSheetClose();
  return <Button label="Close" variant="outline" onPress={() => close()} />;
}
