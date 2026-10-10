/**
 * @senryo/identity — platform-free entry: canonical ids, the entity table, artwork provenance and the mark planner.
 * Components: `@senryo/identity/native` (react-native-svg) and `@senryo/identity/web` (inline SVG).
 */
export { ART, ART_SOURCES } from "./art/index.ts";
export { EXTERNAL_CHAIN_IDS } from "./constants.ts";
export { type DrawFile, type DrawSource, drawOf } from "./draw.ts";
export { ENTITIES } from "./entities.ts";
export { CAIP2, type EntityId, ids } from "./ids.ts";
export { type MarkStatus, markLabel } from "./labels.ts";
export { dollarId, marketId, ROUTE_CHAIN_ID, type RouteChain, routeAssetId } from "./lookup.ts";
export {
  PIXEL_MARKS,
  PIXEL_PATHS,
  type PixelColors,
  type PixelMark as PixelMarkData,
  type PixelMarkName,
  type PixelRole,
  pixelBox,
  pixelFill,
} from "./pixel.ts";
export {
  ENTITY,
  entity,
  entityLabel,
  type GlyphPlan,
  glyphFor,
  hasArt,
  type MarkPlan,
  type Plate,
  planMark,
  type Scheme,
  type VariantRequest,
} from "./registry.ts";
export type { IdentityTheme } from "./theme.ts";
export type {
  ArtFile,
  ArtShape,
  ArtSource,
  ContrastSurface,
  Derivation,
  Entity,
  EntityRole,
  InstrumentType,
  MarkVariant,
  Provenance,
} from "./types.ts";
