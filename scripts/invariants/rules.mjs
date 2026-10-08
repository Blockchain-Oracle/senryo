/**
 * Senryo invariants — the architecture spine, checked in CI with no network (ported runner from Agari, new rule table).
 * Rule shapes:
 *  - pattern rules: { scopes, exts, exclude?, pattern } — every non-comment line matching `pattern` is a finding
 *  - file rules:    { file, mustMatch?, mustNotMatch?, optional? } — one file's content is asserted
 *  - check rules:   { check(rule, ctx) } — arbitrary logic returning findings (lib/repo-checks.mjs)
 * Rules whose files have not landed yet are `optional` / return `skipped`.
 */

import { fontProvenance } from "./lib/font-checks.mjs";
import { identityProvenance } from "./lib/identity-checks.mjs";
import { indexerReadsChainFilter } from "./lib/indexer-checks.mjs";
import {
  addressDrift,
  designJsonPresent,
  easignoreCoversGitignore,
  fileLength,
  indexerIsolated,
  mobileTightLeading,
  navRouteCoverage,
  noSecretsInTree,
  noUiTests,
  pnpmOnly,
  solNoMagicNumbers,
} from "./lib/repo-checks.mjs";
import { sqlNoDroppedTables } from "./lib/sql-checks.mjs";

const TS = [".ts", ".tsx"];
const JS_TS = [".ts", ".tsx", ".mjs", ".js"];
const CODE_SCOPES = ["apps", "packages", "services", "scripts"];
const MONEY_WORDS = "amount|price|balance|margin|pnl|fee|size|collateral|notional|equity";

export const rules = [
  {
    id: "file-length",
    description: "files stay ≤ 400 lines (generated code excluded)",
    scopes: [...CODE_SCOPES, "contracts/src", "contracts/script", "indexer/src"],
    exts: [".ts", ".tsx", ".mjs", ".css", ".sol"],
    check: fileLength,
  },
  { id: "pnpm-only", description: "pnpm is the only package manager", check: pnpmOnly },
  {
    id: "no-float-money",
    description: "money is integer base units — no parseFloat/Number/toFixed on money values",
    scopes: CODE_SCOPES,
    exts: TS,
    pattern: new RegExp(`\\b(parseFloat|Number|toFixed)\\s*\\(\\s*[\\w.]*(${MONEY_WORDS})`, "i"),
  },
  {
    id: "write-boundary",
    description: "only packages/chain sends transactions",
    scopes: ["apps", "packages", "services", "scripts"],
    exts: TS,
    exclude: ["packages/chain"],
    pattern: /\b(writeContract|sendTransaction|sendRawTransaction|sendRawTransactionSync)\s*\(/,
  },
  {
    id: "banned-evm-libs",
    description: "viem only — ethers/web3/wagmi are banned",
    scopes: [...CODE_SCOPES, "indexer/src"],
    exts: JS_TS,
    pattern: /from\s+["'](ethers|web3|wagmi|@wagmi\/[^"']+)["']/,
  },
  {
    id: "viem-import-boundary",
    description: "viem is imported only in packages/chain, packages/account (accounts) and scripts/probe",
    scopes: ["apps", "packages", "services"],
    exts: TS,
    exclude: ["packages/chain", "packages/account"],
    pattern: /from\s+["']viem(\/[^"']*)?["']/,
  },
  {
    id: "account-signs-only",
    description: "packages/account signs, never sends: no viem clients, transports or chain objects (S6)",
    scopes: ["packages/account/src"],
    exts: TS,
    pattern:
      /\b(createWalletClient|createPublicClient|createClient|createTestClient|http|webSocket|fallback)\s*\(|from\s+["']viem\/chains["']/,
  },
  {
    id: "no-custody-backend",
    description: "services never touch user keys (Mera stays client-side)",
    scopes: ["services"],
    exts: TS,
    pattern: /from\s+["'](@senryo\/account|@category-labs\/mera)[^"']*["']/,
  },
  {
    id: "no-raw-getlogs",
    description: "history comes from the indexer (public RPC getLogs is ~100 blocks)",
    scopes: ["apps", "packages", "services"],
    exts: TS,
    pattern: /\b(getLogs|eth_getLogs)\b/,
  },
  {
    id: "chain-literals",
    description: "chain ids and RPC URLs live only in packages/config",
    scopes: ["apps", "packages", "services"],
    exts: TS,
    exclude: ["packages/config"],
    pattern: /\bchainId\s*[:=]\s*(143|10143)\b|rpc\.monad\.xyz|testnet-rpc\.monad\.xyz/,
  },
  {
    id: "explicit-gas",
    description: "every send sets an explicit gas limit (Monad charges the limit)",
    file: "packages/chain/src/send.ts",
    mustMatch: /GAS_HEADROOM_BPS/,
    mustNotMatch: /gas:\s*undefined/,
    optional: true,
  },
  {
    id: "finalized-for-money",
    description: "economic confirmation reads the finalized tag",
    file: "packages/chain/src/confirm.ts",
    mustMatch: /["']finalized["']/,
    optional: true,
  },
  {
    id: "design-literals-web",
    description: "no hex/px literals in web components — use tokens",
    scopes: ["apps/web/src"],
    exts: [".tsx"],
    pattern: /#[0-9a-fA-F]{3,8}\b|\b\d+px\b/,
  },
  {
    id: "design-literals-mobile",
    description: "no hex/rgba outside apps/mobile/src/theme",
    scopes: ["apps/mobile/src"],
    exts: TS,
    exclude: ["apps/mobile/src/theme"],
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(/,
  },
  { id: "mobile-tight-leading", description: "lineHeight never below fontSize", check: mobileTightLeading },
  {
    id: "haptics-via-feedback",
    description: "haptics only through apps/mobile/src/feedback",
    scopes: ["apps/mobile/src"],
    exts: TS,
    exclude: ["apps/mobile/src/feedback"],
    pattern: /from\s+["']expo-haptics["']/,
  },
  {
    id: "motion-import",
    description: "use motion/react, not framer-motion",
    scopes: ["apps", "packages"],
    exts: TS,
    pattern: /from\s+["']framer-motion["']/,
  },
  {
    id: "session-secret-non-persisted",
    description: "PRF output, private keys and mnemonics are never persisted or logged",
    scopes: ["apps", "packages"],
    exts: TS,
    pattern:
      /(prfOutput|privateKey|mnemonic)\b[^\n]*\b(setItem|setItemAsync|localStorage|console\.)|\b(setItem|setItemAsync|localStorage\.setItem|console\.\w+)\([^\n]*\b(prfOutput|privateKey|mnemonic)\b/,
  },
  {
    id: "brand-identity",
    description: "no ported-kit brand names left in live code",
    scopes: ["apps", "packages"],
    exts: TS,
    pattern: /\bAgari\b|上がり|Masayume/,
  },
  {
    id: "public-env-hygiene",
    description: "public env names never carry secrets",
    scopes: [...CODE_SCOPES, "deploy"],
    exts: [...TS, ".example", ".yml", ".yaml"],
    pattern: /\b(NEXT_PUBLIC|EXPO_PUBLIC)_\w*(SECRET|PRIVATE|_PK)\w*/,
  },
  {
    id: "sol-no-timestamp-equality",
    description: "3–4 Monad blocks share a timestamp — never compare it for equality",
    scopes: ["contracts/src"],
    exts: [".sol"],
    pattern: /block\.timestamp\s*==|==\s*block\.timestamp/,
  },
  {
    id: "sol-no-magic-numbers",
    description: "Solidity literals other than 0/1 live in constants",
    check: solNoMagicNumbers,
  },
  { id: "no-ui-tests", description: "tests are not a deliverable — never UI tests", check: noUiTests },
  { id: "no-secrets-in-tree", description: "no committed env files or key-shaped literals", check: noSecretsInTree },
  {
    id: "indexer-isolated",
    description: "indexer is outside the workspace with its own lockfile",
    check: indexerIsolated,
  },
  { id: "design-json-present", description: "each app keeps its 21st design record", check: designJsonPresent },
  {
    id: "easignore-covers-gitignore",
    description: "EAS uploads honour every .gitignore rule (.easignore replaces it)",
    check: easignoreCoversGitignore,
  },
  {
    id: "identity-provenance",
    description: "every mark has a source, licence and matching sha256; generated components are current (S1b.1)",
    check: identityProvenance,
  },
  {
    id: "font-provenance",
    description: "every shipped font has a source, licence and matching sha256 (S1b.6)",
    check: fontProvenance,
  },
  {
    id: "address-drift",
    description: "deployed addresses agree between contracts export and indexer",
    check: addressDrift,
  },
  {
    id: "nav-route-coverage",
    description: "every shared navigation path resolves to a phone route (D-268)",
    check: navRouteCoverage,
  },
  {
    id: "indexer-reads-chain-filter",
    description: "every indexer read filters on chainId (rows exist once per chain, D-173)",
    check: indexerReadsChainFilter,
  },
  {
    id: "sql-no-dropped-tables",
    description: "no service SQL reads or writes a table a migration dropped (0015 pivot)",
    check: sqlNoDroppedTables,
  },
];
