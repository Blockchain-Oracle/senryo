/**
 * Wikimedia Commons as a fetch source (catalog `from: "wikimedia-commons"`), for marks no icon library carries (fund
 * brands). The MediaWiki API's imageinfo (`iiprop=url|sha1|extmetadata`) gives every uploaded version's file URL and
 * SHA-1 plus the file page's own licence fields. The catalog pins one version by its SHA-1, so a later upload over the
 * same title can never change the mark, and only a file the page records as public domain or CC0 is taken. A mark may
 * use several inks (Microsoft's four squares): its ground is the one all of them read on, and its silhouette for the
 * other ground recolours every ink to one.
 */
import { deriveSvg } from "../src/derive.ts";
import type { Derivation } from "../src/types.ts";
import type { FetchSpec } from "./catalog.ts";
import { DARK_INK, type Fetched, get, getSvg, inksOf, LIGHT_INK, type Piece, pathOf, surfaceFor } from "./fetch-lib.ts";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
/** Wikimedia's User-Agent policy (meta.wikimedia.org/wiki/User-Agent_policy): name the client and where to reach it. */
const HEADERS = { "User-Agent": "SenryoIdentityFetch/1.0 (https://github.com/Blockchain-Oracle/senryo)" };
/** extmetadata `License` codes that put no condition on reuse or on a recolour. */
const UNCONDITIONAL = new Set(["pd", "cc0"]);
/** The licence fields quoted into the record, as the file page states them. */
const FIELDS = ["LicenseShortName", "License", "Copyrighted", "Restrictions", "Artist", "Credit"] as const;
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

type Field = (typeof FIELDS)[number];

interface CommonsVersion {
  url: string;
  descriptionurl: string;
  sha1: string;
  timestamp: string;
  extmetadata?: Partial<Record<Field, { value: string }>>;
}

/** extmetadata values are HTML (a credit is often a link): keep the text. */
const plain = (html: string | undefined): string =>
  (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function pinnedVersion(spec: Extract<FetchSpec, { from: "wikimedia-commons" }>): Promise<CommonsVersion> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|sha1|timestamp|extmetadata",
    iiextmetadatafilter: FIELDS.join("|"),
    iilimit: "max",
    titles: `File:${spec.file}`,
  });
  const body = JSON.parse(await get(`${COMMONS_API}?${query}`, HEADERS));
  const versions: CommonsVersion[] = body.query?.pages?.[0]?.imageinfo ?? [];
  const pinned = versions.find((v) => v.sha1 === spec.sha1);
  if (!pinned) throw new Error(`commons: File:${spec.file} has no version with sha1 ${spec.sha1}`);
  // The licence fields describe the file page; an older version may come without them, so the current one's are used.
  return { ...pinned, extmetadata: pinned.extmetadata ?? versions[0]?.extmetadata ?? {} };
}

export async function fromCommons(
  key: string,
  spec: Extract<FetchSpec, { from: "wikimedia-commons" }>,
): Promise<Fetched> {
  const version = await pinnedVersion(spec);
  const field = (name: Field) => plain(version.extmetadata?.[name]?.value);
  if (!UNCONDITIONAL.has(field("License").toLowerCase()))
    throw new Error(
      `commons: File:${spec.file} is "${field("LicenseShortName")}" — only public domain or CC0 is taken`,
    );
  const fileUrl = new URL(version.url);
  fileUrl.search = "";
  const url = fileUrl.href;
  const delivered = await getSvg(url, HEADERS);
  const inks = inksOf(delivered);
  const odd = inks.find((ink) => !SIX_DIGIT_HEX.test(ink));
  if (inks.length === 0 || odd) throw new Error(`commons: File:${spec.file} ink "${odd}" is not a six-digit hex`);
  const grounds = new Set(inks.map(surfaceFor));
  if (grounds.has("light") && grounds.has("dark"))
    throw new Error(`commons: File:${spec.file} has inks for both grounds (${inks.join(", ")}): it reads on neither`);
  const surface = grounds.has("light") ? "light" : grounds.has("dark") ? "dark" : "any";
  const name = (suffix = "") => `commons-${key}${suffix}.svg`;
  const stated = `Copyrighted "${field("Copyrighted")}", License "${field("License")}", LicenseShortName "${field("LicenseShortName")}"`;
  const base = { insetPermille: 0, shape: "free" } as const;
  const pieces: Piece[] = [{ variant: "symbol", name: name(), url, body: delivered, present: { ...base, surface } }];
  // A mark that needs a ground also gets the silhouette for the other one.
  if (surface !== "any") {
    const toLight = surface === "light";
    const derived: Derivation = {
      from: pathOf(key, name()),
      recolour: Object.fromEntries(inks.map((ink) => [ink, toLight ? LIGHT_INK : DARK_INK])),
      basis: `The file page records ${stated} (${version.descriptionurl}): no copyright condition limits a colourway. The silhouette is the delivered file with every ink recoloured to one, its shapes untouched.`,
    };
    pieces.push({
      variant: toLight ? "monoLight" : "monoDark",
      name: name(toLight ? "-light" : "-dark"),
      url,
      body: deriveSvg(delivered, derived),
      present: { ...base, surface: toLight ? "dark" : "light" },
      derived,
    });
  }
  return {
    provenance: "public-domain",
    pageUrl: version.descriptionurl,
    licence: `Wikimedia Commons, File:${spec.file} (version of ${version.timestamp}, sha1 ${spec.sha1}): the file page records ${stated}, Restrictions "${field("Restrictions")}" — read from the MediaWiki API (imageinfo extmetadata). Credited there to ${field("Artist")}; source given: ${field("Credit")}. Public domain covers the file only; the mark stays its owner's trademark and is used nominatively, to identify what it belongs to.`,
    usage:
      "Always beside the ticker and type it identifies, never as a venue badge or an endorsement; drawn whole as delivered, never cropped or re-set.",
    pieces,
  };
}
