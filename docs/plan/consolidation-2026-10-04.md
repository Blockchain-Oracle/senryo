# Senryo source consolidation and storage cleanup — 4 October 2026

## One working baseline

Continue in **`/Users/abu/dev/hackathon/metropolis`**, branch **`codex/senryo-unified`**. Do not use the old physical worktree paths below as current checkouts. The user requested consolidation after several engineers worked in different checkouts, then explicitly authorized removal of unused agent worktrees to recover storage.

The canonical source combines the latest committed premium work (`eb3533d`), the selected Slush Home/Card pass (`d86ccef`), and compatible earlier mobile continuation fixes (`4d399d4`). The premium baseline already contains the committed activity, any-asset, card/outbox, compose, notification, Perpl, Practice swap, stats, identity, money, social, trading and earlier web work. Re-merging those branches would repeat changes already in the baseline.

[Current work register](reference-followthrough-2026-10-04.md) retains the full product scope. [Release record](../design/reviews/2026-10-04-testflight-validation.md) distinguishes source checks, TestFlight availability and phone acceptance. Historical STATUS sections and old recordings do not establish current behavior.

## Reconciliation decisions

| Source | Disposition | What to continue |
|---|---|---|
| `claude/premium-takeover`, `eb3533deb5564cb304b38f0165c97ade4cb08016` | Integrated; duplicate checkout removed | Current money/card/native module/data ownership |
| `codex/slush-home-card-testflight`, `d86cceffbd411c8eb0c065682e1e389bd0496642` | Integrated; managed checkout archived in Codex | Slush Home/Card, shared privacy, Reduced Motion; embedded TestFlight source |
| `codex/mobile-quality-rebuild`, `15ebab9cbb6eee2546b8dd675ec8824b777e23d6` | Preserved branch; compatible fixes adapted in `4d399d4` | Deferred link once-only account prompt, internal URL normalization, funding child Back, current-price label clear space, genuine square logo clear space, nested button contrast |
| Older Home/Card draft at `15ebab9` | Superseded by the newer implementation | Retain current `AmountHero`, `ActionCircle`, shared balance privacy and any-asset/Perpl balance sheet; do not restore the older portfolio model |
| Older `useLatestMovement` draft | Preserved, not blindly ported | Audit freshness across the current balance sheet's multiple query owners; do not promise one coherent block snapshot |
| `claude/contracts`, `2cf904596ddbfe91baa49a5aa9755341a328dafa` | Eleven unique commits preserved; checkout removed | D-251 signed position epoch/TP-SL upgrade needs coordinated contract deployment, ABI/config, keeper and client release; current deployed ABI must remain compatible |
| Uncommitted `claude/web4` work | Exact working-tree snapshot preserved at `codex/archive/web4-20261004`, `f6116703225fa6673c09cd7a0b57dd96c5c76740`; checkout removed | Finish Mainnet web/Perpl parity and shared query extraction before integrating. Mobile typecheck passed there; web typecheck failed because `@/components/perpl/perpl-detail` was missing. No incomplete expansion was represented as shipped |
| All other audited Senryo branches | Already ancestors of the release baseline; refs retained | No unique committed features to recover from their duplicate checkouts |

The funding QR and wallet routes are redirects in the newer source. Their older full-screen implementations were not restored. Swap retains its current any-to-any ticket and gains the child Back fix. Latest social watch/post deep-link mappings remain intact; legacy funding links now merge existing query parameters correctly.

## Recovery archive

Local archive: **`/Users/abu/.codex/archives/metropolis-20261004`**, protected directory permissions. It contains the verified all-branches Git bundle, the worktree audit, the removal ledger, verified initialized submodule bundles, and a small archive of the obsolete generated iOS source. Needed ignored local configuration was copied privately before its checkout was removed; its values are not stored in this document or Git.

The web WIP snapshot's tree was verified to exactly match all tracked and untracked nonignored working files before deletion. The managed release worktree was archived with Codex's recoverable snapshot mechanism after its three outstanding documentation changes were copied into the primary checkout. Branches were retained locally; removing a checkout did not delete its branch history. No GitHub push was performed.

Restore work from its saved branch in the primary checkout when ready to continue. The all-branches bundle provides a separate recovery copy; the managed release archive also appears in this chat's attachments. Dependencies, Metro/Turbo caches, TypeScript build metadata, Pods and Xcode DerivedData are regenerable and were not retained as duplicate development environments.

## Cleanup outcome

The initial audit found **23 Senryo checkouts**. Removed **22 unused checkout directories**: 20 clean custom/old agent checkouts, the exactly preserved web WIP checkout, and the recoverably archived managed release checkout. `git worktree list` now contains only the canonical primary checkout. All 22 original paths were verified absent. Unrelated projects and active sessions are outside this Senryo cleanup.

Final volume measurement reported **24,887,812 KiB available (about 23.7 GiB)**, compared with about 3.8 GiB before this cleanup. This is approximately **20 GiB recovered**; volume activity can change free space during measurement. The recovery archive occupies about 74 MiB.

Removed the obsolete 12 GB Senryo simulator DerivedData tree and the old `0.1.0` generated local iOS/Pods tree. Also removed the inactive design preview's generated `.next` and `node_modules` caches. Preview source and reference media remain; the canonical app checkout retains installed dependencies. Directory-size totals can double-count shared files on APFS; actual volume free space is the measure of recovered storage.

## Remaining acceptance and integration work

TestFlight `0.2.1 (5)` is VALID / IN_BETA_TESTING. Its embedded source is `d86ccef`; the later compatible fixes were published as iOS JavaScript update group `6e96ecac-67d0-4893-accc-6b4370a78e00` on the existing production channel for runtime `0.2.1`, source `4d399d4`. Device application remains unobserved. Device installation, account restore, money/trade lifecycle, accessibility, audio and real provider acceptance remain in the work register.

The live API currently advertises Practice chain 10143 and `card: false`. Card-service connection and coordinated Mainnet/contract/provider readiness remain explicit dependencies. Neither a new layout nor consolidation establishes those integrations as live.
