/**
 * The older role-named icon vocabulary (`<Icon name="bell" />`), now a thin alias over the native symbol set
 * (`symbols.tsx`: SF Symbols on iOS, preloaded Material Symbols on Android) so both spellings render the same glyphs.
 */
import {
  ArrowLeftRight,
  Bell,
  ChartLine,
  Check,
  ChevronRight,
  CircleUserRound,
  Coins,
  Copy,
  CreditCard,
  Download,
  Eye,
  FaceId,
  Globe,
  KeyRound,
  Lifebuoy,
  ListRect,
  Lock,
  ShieldCheck,
  SignOut,
  type SymbolIcon,
  TriangleAlert,
  WifiOff,
} from "./symbols";

export const ICONS = {
  portfolio: ChartLine,
  markets: ListRect,
  trade: ArrowLeftRight,
  card: CreditCard,
  fund: Download,
  bell: Bell,
  account: CircleUserRound,
  offline: WifiOff,
  chevron: ChevronRight,
  faceId: FaceId,
  shield: ShieldCheck,
  lock: Lock,
  key: KeyRound,
  warning: TriangleAlert,
  coins: Coins,
  lifebuoy: Lifebuoy,
  copy: Copy,
  check: Check,
  eye: Eye,
  signOut: SignOut,
  globe: Globe,
} as const satisfies Record<string, SymbolIcon>;

export type IconName = keyof typeof ICONS;
