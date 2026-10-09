/**
 * After `pnpm install`: pnpm 11.24 writes the public hoist link for expo-modules-core (pnpm-workspace.yaml
 * `publicHoistPattern`) to a peer-variant folder it never creates, so TypeScript loses expo-audio's `AudioPlayer` base
 * class and the phone's typecheck fails. Re-point a dangling link at the one folder that exists. Metro and autolinking
 * resolve through `expo`'s own link and never read this one.
 */
import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const STORE = join(ROOT, "node_modules", ".pnpm");
const PACKAGES = ["expo-modules-core"];

for (const name of PACKAGES) {
  const link = join(ROOT, "node_modules", name);
  const linked = existsSync(link);
  const isLink = (() => {
    try {
      return lstatSync(link).isSymbolicLink();
    } catch {
      return false;
    }
  })();
  if (linked) continue;
  const folders = existsSync(STORE)
    ? readdirSync(STORE)
        .filter((d) => d.startsWith(`${name}@`))
        .map((d) => join(STORE, d, "node_modules", name))
        .filter((p) => existsSync(p))
    : [];
  if (folders.length !== 1) {
    console.warn(`repair-hoist: ${name} has ${folders.length} store folders; left as is`);
    continue;
  }
  if (isLink) unlinkSync(link);
  symlinkSync(relative(join(ROOT, "node_modules"), folders[0]), link);
  console.warn(`repair-hoist: ${name} → ${relative(ROOT, folders[0])}`);
}
