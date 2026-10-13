/**
 * Save to Photos (Q3, D-352): a receipt's image or a replay's MP4, with add-only access asked on that tap. A binary
 * without the media library (before runtime 0.5.0) can't — the caller offers Share, whose sheet saves too.
 */
import { mediaLibraryModule } from "./native-modules";

export type SaveResult = "saved" | "refused" | "unavailable";

export async function saveToPhotos(uri: string): Promise<SaveResult> {
  const library = mediaLibraryModule();
  if (!library) return "unavailable";
  const permission = await library.requestPermissionsAsync(true);
  if (!permission.granted) return "refused";
  await library.Asset.create(uri);
  return "saved";
}
