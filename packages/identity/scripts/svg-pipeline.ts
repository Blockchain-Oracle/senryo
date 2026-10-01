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
/** Editor leftovers that draw nothing (styles are already inlined) and have no react-native-svg prop. */
const INERT_ATTRIBUTES = ["class", "xml:space", "data-name"] as const;

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
  return code.replace(NUMERIC_VALUES, 'values="$1"');
}

/**
 * A raster original (an owner that ships PNG only: Perpl's kit, Coinbase's and Binance's site icons), shown exactly as
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
