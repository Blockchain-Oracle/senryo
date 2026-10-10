import type { Metadata } from "next";
import { ArcadeScreen } from "@/features/games/arcade/ArcadeScreen";

export const metadata: Metadata = { title: "Line Rider" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Line Rider</h1>
      <ArcadeScreen
        game="line-rider"
        title="Line Rider"
        how="Keep the dot on the line: hug it to build the combo, drift and your grip drains · move the pointer or use ↑ ↓"
      />
    </div>
  );
}
