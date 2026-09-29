import { View } from "./view";

export default async function Page({ params, searchParams }: { params: Promise<{ dir: string; screen: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { dir, screen } = await params;
  const { mode } = await searchParams;
  return <View dir={dir} screen={screen} alt={mode === "alt"} />;
}
