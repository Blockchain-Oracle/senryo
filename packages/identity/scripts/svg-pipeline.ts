/**
 * The SVG half of the codegen (SVGO 4, then SVGR 8 with @svgr/plugin-jsx): optimise per platform, then guard.
 * - preset-default (styles inlined even when a selector matches many nodes), style → attributes, titles/descs and
 *   dimensions removed, ids prefixed per mark so two inline marks never share an id on one web page.
 * - The guard: `<text>` is forbidden (type must be outlined); anything react-native-svg can't draw is an error rather
 *   than SVGR's silent drop; leftover `style` is an error; every path's arcs are normalised (./arcs.ts).
 * - Filters: the web keeps an owner's own effects (MON token and Bitcoin disc drop shadows). SVGR has no native mapping
 *   for filter primitives, so native removes the `<filter>` and the reference to it — the only change to the art.
 */
import { type Config, transform } from "@svgr/core";
import jsxPlugin from "@svgr/plugin-jsx";
import { type CustomPlugin, optimize } from "svgo";
import { normalizeArcs } from "./arcs.ts";

export type Platform = "native" | "web";

/** Elements react-native-svg draws (SVGR's native map) minus text and raster. */
const DRAWABLE = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "use",
  "symbol",
]);
/** Filter primitives an owner's file may carry; kept on the web, removed (with their filter) on native. */
const FILTER_PARTS = new Set([
  "filter",
  "feGaussianBlur",
  "feOffset",
  "feFlood",
  "feComposite",
  "feColorMatrix",
  "feBlend",
  "feMerge",
  "feMergeNode",
  "feMorphology",
]);
const FORBIDDEN_TEXT = new Set(["text", "tspan", "textPath"]);
/** Editor leftovers and rendering hints that draw nothing (styles are already inlined) and have no react-native-svg prop. */
const INERT_ATTRIBUTES = [
  "class",
  "xml:space",
  "data-name",
  "image-rendering",
  "text-rendering",
  "shape-rendering",
] as const;

function guard(label: string, platform: Platform): CustomPlugin {
  return {
    name: "senryoIdentityGuard",
    fn: () => ({
      element: {
        enter: (node, parent) => {
          if (FORBIDDEN_TEXT.has(node.name)) throw new Error(`${label}: <${node.name}> is forbidden — outline it`);
          if (FILTER_PARTS.has(node.name)) {
            if (platform === "native" && node.name === "filter") {
              parent.children = parent.children.filter((child) => child !== node);
            }
            return;
          }
          if (!DRAWABLE.has(node.name)) throw new Error(`${label}: <${node.name}> has no react-native-svg equivalent`);
          if (node.attributes.style) throw new Error(`${label}: a style attribute survived inlining`);
          for (const inert of INERT_ATTRIBUTES) delete node.attributes[inert];
          if (platform === "native") delete node.attributes.filter;
          if (node.attributes.d) node.attributes.d = normalizeArcs(node.attributes.d);
        },
      },
    }),
  };
}

const ROOT_OPEN = /<svg\b[^>]*>/;
const ROOT_CLOSE = /<\/svg>\s*$/;
const HALF = 2;

/**
 * `ArtFile.crop: "disc"`: clips a full-bleed square file (an icon library's brand-colour background variant) to its
 * inscribed circle. The id is prefixed per mark by `prefixIds` afterwards.
 */
export function cropToDisc(raw: string, viewBox: string): string {
  const [minX = 0, minY = 0, width = 0, height = 0] = viewBox.split(" ").map(Number);
  const open = ROOT_OPEN.exec(raw);
  if (!open || !ROOT_CLOSE.test(raw) || width <= 0 || height <= 0) throw new Error("cropToDisc: not a croppable SVG");
  const circle = `<circle cx="${minX + width / HALF}" cy="${minY + height / HALF}" r="${Math.min(width, height) / HALF}"/>`;
  const head = raw.slice(0, open.index + open[0].length);
  const body = raw.slice(open.index + open[0].length).replace(ROOT_CLOSE, "");
  return `${head}<defs><clipPath id="disc-crop">${circle}</clipPath></defs><g clip-path="url(#disc-crop)">${body}</g></svg>`;
}

export function optimise(raw: string, path: string, prefix: string, platform: Platform): string {
  return optimize(raw, {
    path,
    multipass: true,
    plugins: [
      { name: "preset-default", params: { overrides: { inlineStyles: { onlyMatchedOnce: false } } } },
      "convertStyleToAttrs",
      "removeTitle",
      "removeDesc",
      "removeDimensions",
      "removeXMLNS",
      "removeXlink",
      { name: "prefixIds", params: { prefix, delim: "-" } },
      guard(path, platform),
    ],
  }).data;
}

const SVGR: Config = { plugins: [jsxPlugin], typescript: true, jsxRuntime: "automatic", dimensions: false };

/** SVGR turns a numeric `values="0.1"` into `values={0.1}`; React's filter-primitive types want the string. */
const NUMERIC_VALUES = /\bvalues=\{([\d.eE+-]+)\}/g;

export async function svgComponent(svg: string, component: string, platform: Platform): Promise<string> {
  const code = await transform(svg, { ...SVGR, native: platform === "native" }, { componentName: component });
  const typed = code.replace(NUMERIC_VALUES, 'values="$1"');
  return platform === "web" ? scopeIds(typed) : typed;
}

const ID_ATTR = / id="([^"]+)"/g;
const URL_REF = /="url\(#([^)]+)\)"/g;
const HREF_REF = / (href|xlinkHref)="#([^"]+)"/g;
const ARROW_BODY = /=> (<svg[\s\S]*<\/svg>);/;

/**
 * The web only (react-native-svg resolves ids inside each `<Svg>`): the prefix keeps two different marks apart, but
 * two copies of one mark on a page still shared ids, and a reference resolves to the first copy — when that copy is
 * hidden (the desktop rail's seal at phone width) its gradients paint nothing. Each render suffixes its ids and
 * references with `useId`.
 */
function scopeIds(code: string): string {
  if (!code.match(ID_ATTR)) return code;
  if (!ARROW_BODY.test(code)) throw new Error("scopeIds: unexpected SVGR output shape");
  return code
    .replace(ID_ATTR, " id={`$1${u}`}")
    .replace(URL_REF, "={`url(#$1${u})`}")
    .replace(HREF_REF, " $1={`#$2${u}`}")
    .replace('import type { SVGProps } from "react";', 'import { type SVGProps, useId } from "react";')
    .replace(ARROW_BODY, '=> {\n  const u = useId().replace(/[^\\w-]/g, "");\n  return $1;\n};');
}

/**
 * A raster original (an owner that ships PNG only: Coinbase's and Binance's site icons), shown exactly as
 * delivered: RN `Image` from the bundled asset, or `<img>` on the web. Same props surface as the SVG components.
 */
export function rasterComponent(component: string, assetPath: string, platform: Platform): string {
  if (platform === "native") {
    return [
      'import { Image } from "react-native";',
      'import type { SvgProps } from "react-native-svg";',
      `const SOURCE = require(${JSON.stringify(assetPath)});`,
      `const ${component} = ({ width, height }: SvgProps) => (`,
      '  <Image source={SOURCE} style={{ width: Number(width), height: Number(height) }} resizeMode="contain" />',
      ");",
      `export default ${component};`,
      "",
    ].join("\n");
  }
  return [
    'import type { SVGProps } from "react";',
    `import SOURCE from ${JSON.stringify(assetPath)};`,
    `const ${component} = ({ width, height }: SVGProps<SVGSVGElement>) => (`,
    '  <img src={typeof SOURCE === "string" ? SOURCE : SOURCE.src} width={width} height={height} alt="" style={{ objectFit: "contain" }} />',
    ");",
    `export default ${component};`,
    "",
  ].join("\n");
}
