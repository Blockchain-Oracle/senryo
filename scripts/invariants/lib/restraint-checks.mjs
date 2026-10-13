/**
 * Restraint (Q0, D-346; the owner's 13 Oct review, `docs/research/review-2026-10-13/density-audit.md`): the gate keeps
 * surfaces quiet once a Q area makes them so.
 *  - dot chains: no " · " chain over three segments on an operational surface (a line with three separators, or a
 *    `.join(" · ")` of an unbounded list); help, legal and the public pages are out of scope;
 *  - one fact list per app: no ad-hoc `<dl>` grid or `Fact` / `SummaryRow` component outside `FactList`;
 *  - no explainers: the settings and exit components carry no `hint` / `description` sentence (validation and ⓘ may).
 * Surfaces a later Q area rebuilds are allowed by name until then, each with the stage that removes it; an allowance
 * whose file is already clean is itself a finding, so the list only shrinks.
 */
import { finding } from "./report.mjs";
import { codeLines, readText, walkFiles } from "./walk.mjs";

const TS = [".ts", ".tsx"];
const OPERATIONAL = ["apps/web/src", "apps/mobile/src", "packages/calls/src", "packages/search/src"];
/** Help, legal and the public site say things in sentences on purpose. */
const OUT_OF_SCOPE = [
  "apps/web/src/app/terms",
  "apps/web/src/app/privacy",
  "apps/web/src/app/judges",
  "apps/web/src/components/public",
  "apps/web/src/features/landing",
  "apps/mobile/src/app/account/help.tsx",
  "apps/web/src/components/shell/ShortcutsModal.tsx",
];
const SEPARATOR = / · /g;
const MAX_SEPARATORS = 2;
const JOIN = /\.join\(\s*["'`] · ["'`]\s*\)/;

/** Chains a later stage removes (file → the stage and what goes). */
const CHAIN_ALLOWED = new Map([
  ["apps/web/src/features/terminal/CrowdLine.tsx", "Q2: the crowd sentence is deleted"],
  ["apps/mobile/src/features/terminal/CrowdLine.tsx", "Q2: the crowd sentence is deleted"],
  ["packages/calls/src/exits.ts", "Q2: exit sheets become one ruler"],
  ["packages/calls/src/receipt.ts", "Q3: one receipt composition"],
  ["packages/calls/src/status-words.ts", "Q5: Status as one verdict and the strips"],
  ["apps/web/src/features/status/StatusBoard.tsx", "Q5: Status as one verdict and the strips"],
  ["apps/mobile/src/features/status/StatusScreen.tsx", "Q5: Status as one verdict and the strips"],
]);

/** Fact grids a later stage moves onto `FactList`. */
const GRID_ALLOWED = new Map([
  ["apps/web/src/components/shell/drawers/OneTapDrawer.tsx", "Q5: Settings rows"],
  ["apps/web/src/components/shell/search/Preview.tsx", "Q6: search's market row contract"],
  ["apps/web/src/features/calls/StatsCard.tsx", "Q3: the record as two figures and a strip"],
  ["apps/web/src/features/events/EventDetail.tsx", "Q4: event detail"],
  ["apps/web/src/features/games/LuckyScreen.tsx", "Q6: the games hub"],
  ["apps/web/src/features/games/arcade/StageParts.tsx", "Q6: the games hub"],
  ["apps/web/src/features/receipts/PendingTradeCard.tsx", "Q3: one receipt composition"],
  ["apps/web/src/features/receipts/TradeSlip.tsx", "Q3: one receipt composition"],
  ["apps/mobile/src/app/account/security.tsx", "Q5: Settings rows"],
  ["apps/mobile/src/features/calls/WindowProof.tsx", "Q3: one receipt composition"],
  ["apps/mobile/src/features/earn/EarnScreen.tsx", "Q5: Earn"],
  ["apps/mobile/src/features/events/EventDetailScreen.tsx", "Q4: event detail"],
  ["apps/mobile/src/features/terminal/ExitSheet.tsx", "Q2: exit sheets become one ruler"],
]);
/** Explainers a later stage removes. */
const EXPLAINER_ALLOWED = new Map([
  ["apps/web/src/features/terminal/ExitModal.tsx", "Q2: exit sheets become one ruler"],
  ["apps/web/src/features/terminal/RideExitModal.tsx", "Q2: exit sheets become one ruler"],
  ["apps/web/src/features/terminal/PartModal.tsx", "Q2: exit sheets become one ruler"],
  ["apps/mobile/src/features/terminal/ExitSheet.tsx", "Q2: exit sheets become one ruler"],
]);
const SETTINGS_AND_EXITS =
  /(Settings|SettingsBody|ExitSheet|ExitModal|RideExitModal|RideExitSheet|PartSheet|PartModal)\.tsx$/;
const EXPLAINER = /\b(hint|description)=/;
const FACT_LISTS = new Set(["apps/web/src/components/ui/fact-list.tsx", "apps/mobile/src/components/kit/FactList.tsx"]);
const WEB_GRID = /<dl\b|function (Fact|SummaryRow|FactRow)\b/;
const PHONE_GRID = /function (Fact|SummaryRow|FactRow|Row)\b/;

const outOfScope = (rel) => OUT_OF_SCOPE.some((p) => rel === p || rel.startsWith(`${p}/`));

/** Findings per file, then the allowance list applied: allowed files pass, clean allowed files are stale. */
function withAllowances(rule, hits, allowed) {
  const findings = [];
  for (const [rel, list] of hits) {
    if (allowed.has(rel)) continue;
    for (const f of list) findings.push(finding(rule, f.what, `${rel}:${f.line}`));
  }
  for (const [rel, why] of allowed) {
    if (!hits.has(rel)) findings.push(finding(rule, `allowed until "${why}" but already clean — remove it`, rel));
  }
  return findings;
}

export function dotChains(rule, ctx) {
  const hits = new Map();
  for (const scope of OPERATIONAL) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, TS)) {
      if (outOfScope(rel)) continue;
      for (const [line, text] of codeLines(readText(abs))) {
        const count = (text.match(SEPARATOR) ?? []).length;
        const what =
          count > MAX_SEPARATORS
            ? `${count + 1} segments chained with " · "`
            : JOIN.test(text)
              ? 'an unbounded `.join(" · ")`'
              : null;
        if (what) hits.set(rel, [...(hits.get(rel) ?? []), { line, what }]);
      }
    }
  }
  return withAllowances(rule, hits, CHAIN_ALLOWED);
}

export function factListOnly(rule, ctx) {
  const hits = new Map();
  for (const [scope, grid] of [
    ["apps/web/src", WEB_GRID],
    ["apps/mobile/src", PHONE_GRID],
  ]) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [".tsx"])) {
      if (FACT_LISTS.has(rel) || outOfScope(rel)) continue;
      for (const [line, text] of codeLines(readText(abs))) {
        const m = grid.exec(text);
        if (m) hits.set(rel, [...(hits.get(rel) ?? []), { line, what: `\`${m[0]}\` — use FactList` }]);
      }
    }
  }
  return withAllowances(rule, hits, GRID_ALLOWED);
}

export function noExplainers(rule, ctx) {
  const hits = new Map();
  for (const scope of ["apps/web/src/features/terminal", "apps/mobile/src/features/terminal"]) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [".tsx"])) {
      if (!SETTINGS_AND_EXITS.test(rel)) continue;
      for (const [line, text] of codeLines(readText(abs))) {
        const m = EXPLAINER.exec(text);
        if (m)
          hits.set(rel, [
            ...(hits.get(rel) ?? []),
            { line, what: `\`${m[0]}\` — say it with the control, not a sentence` },
          ]);
      }
    }
  }
  return withAllowances(rule, hits, EXPLAINER_ALLOWED);
}
