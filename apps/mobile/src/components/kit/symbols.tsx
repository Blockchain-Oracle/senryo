/**
 * Native utility icons (D-237 rule 4): SF Symbols on iOS, Material Symbols on Android — never a web icon set. Each
 * export keeps the call-site shape the app already uses (`size`, `color`, `strokeWidth`), so a screen swaps its import
 * and gets the platform's own glyphs. Android draws the glyph as text in the vendored Material Symbols face, preloaded
 * with the app fonts (`theme/fonts.ts`), so an icon is there on its first frame instead of after a per-mount load.
 * Real-world identities (tokens, chains, people, providers) never come from here: those are `EntityMark` / `Avatar`.
 */
import { type SFSymbol, SymbolView, type SymbolWeight } from "expo-symbols";
import type { ComponentType } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { SIZE } from "~/theme";
import { ANDROID_CODEPOINTS, type AndroidSymbolName } from "./symbol-codepoints";

/** The family key `theme/fonts.ts` registers (Android only). */
export const SYMBOL_FONT_FAMILY = "MaterialSymbols_400Regular";

interface Glyph {
  ios: SFSymbol;
  /** Filled variant for active states (`fill` set to a colour), iOS only — the Android face is outlined. */
  iosFilled?: SFSymbol;
  android: AndroidSymbolName;
}

export interface SymbolProps {
  size?: number;
  color?: string;
  /** Lucide-style stroke → SF weight: ≤1.5 regular, 2 medium, ≥2.5 semibold. */
  strokeWidth?: number;
  /** Any colour other than "none"/"transparent" draws the filled variant (iOS). */
  fill?: string;
  accessibilityLabel?: string;
}

/** The type screens pass around for "an icon component" (was lucide's `LucideIcon`). */
export type SymbolIcon = ComponentType<SymbolProps>;
export type LucideIcon = SymbolIcon;

const STROKE_REGULAR = 1.5;
const STROKE_SEMIBOLD = 2.5;

function weightOf(stroke: number | undefined): SymbolWeight {
  if (stroke === undefined) return "medium";
  if (stroke <= STROKE_REGULAR) return "regular";
  return stroke >= STROKE_SEMIBOLD ? "semibold" : "medium";
}

function NativeSymbol({
  glyph,
  size = SIZE.icon,
  color,
  strokeWidth,
  fill,
  accessibilityLabel,
}: SymbolProps & {
  glyph: Glyph;
}) {
  const label = accessibilityLabel ? { accessible: true, accessibilityLabel } : { accessibilityElementsHidden: true };
  if (Platform.OS === "android") {
    return (
      <View style={{ width: size, height: size }} {...label}>
        <Text allowFontScaling={false} style={[styles.android, { fontSize: size, lineHeight: size, color }]}>
          {String.fromCharCode(ANDROID_CODEPOINTS[glyph.android])}
        </Text>
      </View>
    );
  }
  const filled = fill !== undefined && fill !== "none" && fill !== "transparent";
  return (
    <View {...label}>
      <SymbolView
        name={filled && glyph.iosFilled ? glyph.iosFilled : glyph.ios}
        size={size}
        weight={weightOf(strokeWidth)}
        {...(color ? { tintColor: color } : {})}
      />
    </View>
  );
}

function symbol(glyph: Glyph, displayName: string): SymbolIcon {
  const Component = (props: SymbolProps) => <NativeSymbol glyph={glyph} {...props} />;
  Component.displayName = displayName;
  return Component;
}

// The vocabulary (one line each). Names keep the call sites' existing identifiers.
export const ArrowDown = symbol({ ios: "arrow.down", android: "arrow_downward" }, "ArrowDown");
export const ArrowDownUp = symbol({ ios: "arrow.up.arrow.down", android: "swap_vert" }, "ArrowDownUp");
export const ArrowLeft = symbol({ ios: "arrow.left", android: "arrow_back" }, "ArrowLeft");
export const ArrowLeftRight = symbol({ ios: "arrow.left.arrow.right", android: "swap_horiz" }, "ArrowLeftRight");
export const ArrowRight = symbol({ ios: "arrow.right", android: "arrow_forward" }, "ArrowRight");
export const ArrowUp = symbol({ ios: "arrow.up", android: "arrow_upward" }, "ArrowUp");
export const Ban = symbol({ ios: "nosign", android: "block" }, "Ban");
export const Bell = symbol({ ios: "bell", iosFilled: "bell.fill", android: "notifications" }, "Bell");
export const BellPlus = symbol({ ios: "bell.badge", android: "notification_add" }, "BellPlus");
export const CalendarDays = symbol({ ios: "calendar", android: "calendar_month" }, "CalendarDays");
export const ChartCandlestick = symbol({ ios: "chart.bar.xaxis", android: "candlestick_chart" }, "ChartCandlestick");
export const Check = symbol({ ios: "checkmark", android: "check" }, "Check");
export const ChevronDown = symbol({ ios: "chevron.down", android: "expand_more" }, "ChevronDown");
export const ChevronLeft = symbol({ ios: "chevron.left", android: "chevron_left" }, "ChevronLeft");
export const ChevronRight = symbol({ ios: "chevron.right", android: "chevron_right" }, "ChevronRight");
export const CircleCheck = symbol({ ios: "checkmark.circle.fill", android: "check_circle" }, "CircleCheck");
export const CirclePlus = symbol({ ios: "plus.circle", android: "add_circle" }, "CirclePlus");
export const CircleUserRound = symbol(
  { ios: "person.crop.circle", iosFilled: "person.crop.circle.fill", android: "account_circle" },
  "CircleUserRound",
);
export const Copy = symbol({ ios: "doc.on.doc", android: "content_copy" }, "Copy");
export const CornerDownRight = symbol(
  { ios: "arrow.turn.down.right", android: "subdirectory_arrow_right" },
  "CornerDownRight",
);
export const CreditCard = symbol(
  { ios: "creditcard", iosFilled: "creditcard.fill", android: "credit_card" },
  "CreditCard",
);
export const Crosshair = symbol({ ios: "scope", android: "my_location" }, "Crosshair");
export const Delete = symbol({ ios: "delete.left", android: "backspace" }, "Delete");
export const Ellipsis = symbol({ ios: "ellipsis", android: "more_horiz" }, "Ellipsis");
export const ExternalLink = symbol({ ios: "arrow.up.right.square", android: "open_in_new" }, "ExternalLink");
export const Flag = symbol({ ios: "flag", iosFilled: "flag.fill", android: "flag" }, "Flag");
export const Gauge = symbol({ ios: "gauge.with.dots.needle.50percent", android: "speed" }, "Gauge");
export const Gift = symbol({ ios: "gift", android: "redeem" }, "Gift");
export const Grid3x3 = symbol({ ios: "square.grid.3x3", android: "grid_on" }, "Grid3x3");
export const Heart = symbol({ ios: "heart", iosFilled: "heart.fill", android: "favorite" }, "Heart");
export const History = symbol({ ios: "clock.arrow.circlepath", android: "history" }, "History");
export const House = symbol({ ios: "house", iosFilled: "house.fill", android: "home" }, "House");
export const IdCard = symbol({ ios: "person.text.rectangle", android: "badge" }, "IdCard");
export const Info = symbol({ ios: "info.circle", android: "info" }, "Info");
export const KeyRound = symbol({ ios: "key", android: "key" }, "KeyRound");
export const Lock = symbol({ ios: "lock", iosFilled: "lock.fill", android: "lock" }, "Lock");
export const Minus = symbol({ ios: "minus", android: "remove" }, "Minus");
export const Pin = symbol({ ios: "pin", iosFilled: "pin.fill", android: "push_pin" }, "Pin");
export const Plus = symbol({ ios: "plus", android: "add" }, "Plus");
export const QrCode = symbol({ ios: "qrcode", android: "qr_code" }, "QrCode");
export const ScanLine = symbol({ ios: "qrcode.viewfinder", android: "qr_code_scanner" }, "ScanLine");
export const ScrollText = symbol({ ios: "scroll", android: "description" }, "ScrollText");
export const Search = symbol({ ios: "magnifyingglass", android: "search" }, "Search");
export const Send = symbol({ ios: "paperplane", iosFilled: "paperplane.fill", android: "send" }, "Send");
export const Settings = symbol({ ios: "gearshape", iosFilled: "gearshape.fill", android: "settings" }, "Settings");
export const Share = symbol({ ios: "square.and.arrow.up", android: "ios_share" }, "Share");
export const Share2 = symbol({ ios: "square.and.arrow.up", android: "share" }, "Share2");
export const ShieldCheck = symbol({ ios: "checkmark.shield", android: "verified_user" }, "ShieldCheck");
export const Signal = symbol({ ios: "antenna.radiowaves.left.and.right", android: "signal_cellular_alt" }, "Signal");
export const SlidersHorizontal = symbol({ ios: "slider.horizontal.3", android: "tune" }, "SlidersHorizontal");
export const SquarePen = symbol({ ios: "square.and.pencil", android: "edit_square" }, "SquarePen");
export const Star = symbol({ ios: "star", iosFilled: "star.fill", android: "star" }, "Star");
export const Trash = symbol({ ios: "trash", android: "delete" }, "Trash");
export const Trash2 = symbol({ ios: "trash", android: "delete" }, "Trash2");
export const UsersRound = symbol({ ios: "person.2", iosFilled: "person.2.fill", android: "group" }, "UsersRound");
export const Volume = symbol({ ios: "speaker.wave.2", android: "volume_up" }, "Volume");
export const VolumeX = symbol({ ios: "speaker.slash", android: "volume_off" }, "VolumeX");
export const ChartLine = symbol({ ios: "chart.line.uptrend.xyaxis", android: "monitoring" }, "ChartLine");
export const Coins = symbol(
  { ios: "dollarsign.circle", iosFilled: "dollarsign.circle.fill", android: "paid" },
  "Coins",
);
export const Download = symbol({ ios: "arrow.down.to.line", android: "download" }, "Download");
export const Eye = symbol({ ios: "eye", iosFilled: "eye.fill", android: "visibility" }, "Eye");
export const FaceId = symbol({ ios: "faceid", android: "face" }, "FaceId");
export const Globe = symbol({ ios: "globe", android: "public" }, "Globe");
export const Lifebuoy = symbol({ ios: "lifepreserver", android: "support" }, "Lifebuoy");
export const ListRect = symbol({ ios: "list.bullet.rectangle", android: "view_list" }, "ListRect");
export const SignOut = symbol({ ios: "rectangle.portrait.and.arrow.right", android: "logout" }, "SignOut");
export const TriangleAlert = symbol({ ios: "exclamationmark.triangle", android: "warning" }, "TriangleAlert");
export const WifiOff = symbol({ ios: "wifi.slash", android: "wifi_off" }, "WifiOff");
export const Snowflake = symbol({ ios: "snowflake", android: "ac_unit" }, "Snowflake");
export const Wallet = symbol({ ios: "wallet.pass", android: "account_balance_wallet" }, "Wallet");
export const Landmark = symbol({ ios: "building.columns", android: "account_balance" }, "Landmark");
export const Layers = symbol({ ios: "square.stack.3d.up", android: "layers" }, "Layers");
export const Swords = symbol({ ios: "figure.fencing", android: "swords" }, "Swords");
export const Trophy = symbol({ ios: "trophy", android: "emoji_events" }, "Trophy");
export const Receipt = symbol(
  { ios: "list.bullet.rectangle.portrait", iosFilled: "list.bullet.rectangle.portrait.fill", android: "receipt_long" },
  "Receipt",
);
export const LayoutGrid = symbol(
  { ios: "square.grid.2x2", iosFilled: "square.grid.2x2.fill", android: "grid_view" },
  "LayoutGrid",
);
// Merchant categories (card payments).
export const Food = symbol({ ios: "fork.knife", android: "restaurant" }, "Food");
export const Groceries = symbol({ ios: "cart", android: "shopping_cart" }, "Groceries");
export const Transport = symbol({ ios: "car", android: "directions_car" }, "Transport");
export const Books = symbol({ ios: "book", android: "menu_book" }, "Books");
export const Electronics = symbol({ ios: "laptopcomputer", android: "laptop" }, "Electronics");
export const Shopping = symbol({ ios: "bag", android: "shopping_bag" }, "Shopping");
export const X = symbol({ ios: "xmark", android: "close" }, "X");

const styles = StyleSheet.create({
  android: { fontFamily: SYMBOL_FONT_FAMILY, includeFontPadding: false, textAlign: "center" },
});
