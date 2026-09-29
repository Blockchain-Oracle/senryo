import { GalleryView } from "../view";

export default async function Page({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: Promise<{ theme?: string }> }) {
  const { group } = await params;
  const { theme } = await searchParams;
  return <GalleryView group={group} dark={theme === "dark"} />;
}
