# J1 onboarding artwork, card face and seal: Codex design review

**Reviewed 1 October 2026 by Codex (`gpt-6.1-sol`, reasoning `xhigh`, read-only sandbox). Closing verdict (round 5): all nine
pieces PASS as static first-pass masters suitable for the user's design review. B12 stays open: the user's own design
review is the gate, and nothing here establishes motion, native rendering or J1 behaviour.**

This is the review record for the authored J1 artwork package of plan step S1b.3 (`docs/plan/stage-01b-design-v2.md`,
blocker B12): six onboarding scenes, the pending-passkey art, the completion foil and twelve default avatars, written
by `brand/scripts/onboarding.py` into `brand/art/onboarding/` and `brand/art/avatars/`. The artwork owner (an agent)
ran the review after each revision and worked through every finding; the reviewer's text below is verbatim. The
redrawn Kinpaku card face and the gold-leaf seal were added afterwards (rounds 6 and 7), and the seal's finish was
reviewed once more on its own (round 8, at the end of this file).

## How it was run

- Command, from the art worktree, once per round:
  `codex exec -m gpt-6.1-sol -c model_reasoning_effort="xhigh" -s read-only -C <worktree> -i <four contact sheets> "<brief>" </dev/null`
- The brief gave the reviewer the authority documents (direction §2/§10, the mobile UX review R03/R15/§4, the agent
  brief, v2-plan §5.10), the reference frames (Solflare S01–S06 and S13, Phantom P01/P05/P10, local study, never
  committed), the contact sheets from `brand/scripts/sheets.py` (six scenes in 402 × 874 phones on the dark and light
  grounds, each scene at 2x, pending art and foil on both grounds, avatars at 48 px and 96 px), and from round 2 on its
  own earlier verdicts. It was told that nothing was protected and to pass or fail each piece.
- Links inside the verbatim text point into the review worktree (`.claude/worktrees/art-j1`) and at the reviewer's own
  earlier verdict files; read them as repo-relative paths.
- "PASS" in every round means: a static first-pass master good enough to hand to the user's design review. It never
  means production approval, motion acceptance or native acceptance.

## Rounds

| Round | Pass / 9 | Failed | What changed before the next round |
|---|---|---|---|
| 1 | 2 | Scenes 1, 3, 4, 5, 6, completion foil, avatars | Scene 1 recomposed around two continuous paths; Markets recomposed as three trays with native pair labels; LP rebuilt as a vault well with a bolted door; gold leaf redrawn thin; Practice/Mainnet relabelled with a blue-lined tray; foil surface rebuilt; avatar faces enlarged; shadows rebuilt |
| 2 | 7 | Scene 4 (LP), completion foil | LP base, pool disturbance and hinges redone; foil strips replaced by a cell mesh; rims, shadows and recess refined across the passing pieces |
| 3 | 8 | Completion foil (visible cell lattice) | Foil repainted with one continuous gradient per bend (no mesh); key laid straight over its bed; trays, rings, tear and labels refined |
| 4 | 9 | none | Last refinements: thinner key sidewall, quieter rings and tray lips, asymmetric LP impact, uneven leaf seams, impression shaded by the light, avatar necklines filled |
| 5 | 9 | none | Closing confirmation on the exact art that was committed (see the note below) |

After the round-5 verdict one byte-level change was made to `scene-lp.svg`: the door's foreshortening transform was
rewritten from `matrix(1 0 0 0.8 0 0)` to `scale(1 0.8)`, because the identity codegen's SVGO pass rounded the merged
matrix and drew the door wrongly in the generated component. The master renders pixel-identically before and after
(RMSE 0); its sha256 was re-pinned. All twenty generated components were then compared with their masters (RMSE ≤ 1.5e-4).

The motion strips the reviewer mentions are review aids from `brand/scripts/motion.py` (three samples made only by
moving the masters' named groups). They are not the Skia/Reanimated implementation.

## After round 5: integration contract, card face and seal

The lead then set the integration contract for the scenes and asked for two more pieces in the same pass. Codex
reviewed those two over two further rounds (same command, verbatim at the end of this file).

- **Layers.** Every master was restructured so its top-level groups are one layer per unit of motion (object or
  shadow), listed in `brand/art/onboarding/layers.json`. Rendered output was compared before and after: pixel-identical
  (RMSE 0) for all eight onboarding masters.
- **Kinpaku card face and back** (`brand/kinpaku-card*.svg`, the Card tab's raster) redrawn as the scene-5 card, flat.
  Round 6: front FAIL (its seal was a redrawn single-frame version; the tear read thick), back PASS. Round 7: front
  PASS, back PASS.
- **Seal** (`brand/senryo-seal.svg` and the marks built from it) recoloured through the gold-leaf ramp, geometry
  unchanged. Round 6 and 7: PASS, with the small-size hairline called out (the README now sends sizes under 32 px to
  the simplified geometry).
- **Shared change that touched reviewed scenes.** The round-6 fix put the seal's own carving on the card and on the
  practice notes, and made the leaf tear finer; that changed the card inside scenes 1 and 5 and the stamps in scene 6.
  Round 7 re-confirmed all three: the round-5 PASS stands for each.
- **Changed after the round-7 verdict, not re-reviewed** (each one a refinement the reviewer asked for): the Practice
  label plate narrowed to restore its 10 pt right inset; fewer and smaller leaf fragments along the card's tear (card
  face, scenes 1 and 5); the card back's band lost its continuous outline and some creases.
- **Round 8: the seal's finish, on its own.** Before the round, the seal's field moved to the full five-stop ramp
  (`MATERIAL.goldLeaf` with `#AE8941` and `#EACF8C`), a soft radial bloom replaced the even corner highlight, and the
  inverse took a lit lacquer field with gold-leaf inlay. Codex saw the seal at 24, 32, 48 and 88 px on `#0A0911` and
  `#13121A` (`brand/review/seal-sizes.png`), the variants at 264 px, the old lemon seal and the card front at 400 px.
  Verdict: small seal PASS (narrowly), large seal FAIL (brass plaque: a broad ochre face and a conspicuous cream line
  under the carving), inverse FAIL (its 千 lit apart from its frames), mono PASS, card front PASS.
- **Fixed once after round 8, not re-reviewed.** Large seal: the ramp starts at the cream highlight and carries the light
  gold across the upper-left face (`#FFF0BC` 0, `#EACF8C` .2, `#D4AE5B` .48, `#AE8941` .8, `#886426` 1), the bloom is
  weaker, and the light caught under the carving dropped from 0.5 to 0.3 opacity at half the offset, fading toward the
  far corner. Inverse: the 千 is placed in seal coordinates (no transform), so its `userSpaceOnUse` inlay gradient is the
  same light as the frames'. Geometry unchanged in both.

Findings from those rounds that are not art and are still open: the Card tab's overlay starts at 52 % across and its
holder/expiry row is cramped at phone width (the art leaves clear lacquer from about 42 %); the app icon's seal scale
and the D2 wordmark were left as they are.

## What still falls short (the reviewer's closing list, in short)

- Completion foil is the weakest material piece: the impression still reads partly as an outlined stamp, and the
  retained creases do not yet belong to one decisively bent surface (Solflare S13 describes its deformation better).
- Supporting objects are too prominent: the Markets trays, the pending tablet, the Mainnet tray's blue lining.
- The passkey key still shows a dark ledge under the bow and teeth (recess + shadow + sidewall), in scene 2 and pending.
- Some geometry is mechanically regular: leaf overlap rows, the paper bundle, the liquid's reflection strokes.
- Scenes 1 and 3 still lean on the copy to explain the relationship they picture.
- Unreviewed by anyone: motion as implemented, react-native-svg/Skia parity on device, the pending screen's layout,
  native label binding.

## Round 5 — closing verdict (verbatim)

**1. Overall verdict**

**ROUND 5: PASS for all nine pieces as static first-pass masters suitable for the user’s design review.** The refinements reduce competing edges and decorative weight without introducing a visible defect that warrants reversing a PASS. The package remains appreciably below Solflare/Phantom’s finish, chiefly in material conviction, supporting-object restraint and how directly the illustrations explain their subjects. **B12 cannot close on this reviewer’s evidence alone: the user’s own design review must pass, as required by [§5.10](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/docs/plan/v2-plan.md:656).**

**2. Per piece**

This review covers the current uncommitted artwork in `/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1`, branch `stage/S1b-art`, HEAD `c3a1af0`. I read Round 4 and the specified authorities; inspected all ten reference frames, both scene sheets, six individual dark 2× scenes, extras, both avatar sheets and three motion strips; and checked the current masters and relevant scripts. Read-only raster comparisons matched the inspected scene regions and all twelve avatar squares exactly; the extras matched within one colour-channel value after compositing, and all 20 master hashes match the registry. No files were edited and no project builds were run; phone chrome, controls, copy and label typography remain mock/native context.

**Scene 1 — One balance: PASS**

The destination rings are visibly quieter, their centres are paler, and the ground paths read as fine gold lines with faint edge shade rather than broad dark channels. The chest remains the source, and both destinations remain identifiable.

The closed ellipses still make the card and koban feel like objects hovering over display stations. The paths also continue the chest’s decorative cords, so the relationship reads more ceremonially than functionally.

Priority changes:

1. Fade part of each destination outline, letting the object and its shadow establish the landing point.
2. Simplify the transition from chest decoration to ground path so the branching relationship reads more immediately.

**Scene 2 — Passkey: PASS**

The reduced silver sidewall and closer bed lessen the dark mass beneath the bow and teeth. The tablet has one subdued reflection band, and the phone remains a clear device cue.

A black ledge still projects beneath the bow and tooth tips, combining recess, shadow and metal thickness. At 2×, the tablet band also retains a straight, visibly constructed boundary.

Priority changes:

1. Narrow or lighten the exposed recess selectively beneath the bow and teeth; retain enough silver sidewall to preserve the key’s volume.
2. Blend the tablet band’s boundary more gradually. Further decorative surface detail would work against this improvement.

**Scene 3 — Markets: PASS**

The quieter lips, weaker rim highlights, sparse dust and faint reflections let the commodities, flag pairs and crypto marks carry more contrast. EUR/USD and JPY/USD remain clearly associated with their respective pairs.

The three containers still resemble accessory cases. Their repeated dark inner channels and rounded borders occupy substantial visual weight, particularly around the smaller commodities. Reducing decoration has helped, but container geometry remains the larger issue.

Priority changes:

1. Reduce the apparent inner-channel depth, starting with the commodity tray.
2. Break or soften selected long rim highlights instead of giving every tray a continuous enclosing contour.

Preserve the demonstrated pair-label association and readability.

**Scene 4 — LP: PASS**

The disturbance is visibly less regular: arc lengths and strengths differ, and the double oval lowers the central dimple’s contrast. The dimmer hinge highlights and rivets improve attention around the pool.

The small white crescent and isolated bright bead still make the impact resemble a drawn symbol placed on the liquid. Several arc ends remain conspicuously rounded strokes rather than reflections that broaden and taper with the surface.

Priority changes:

1. Give the nearest reflection a clearer widening-to-tapering shape and reduce the isolated white bead.
2. Connect the dimple’s shading more gently to the surrounding blue surface.

The vault silhouette, aligned drop and recessed pool remain sufficient for the static composition.

**Scene 5 — Kinpaku: PASS**

The tear’s shorter bites reduce the distracting projection, and the unequal seam strengths improve the foil. The card remains dominant; the supporting book and tweezers provide a recognizable material-making context.

The quadrilateral overlaps are still arranged too regularly. Their opacity varies, but the underlying rows remain visible, particularly across the card’s lower gold area. The torn boundary also retains several similarly abrupt angular notches.

Priority changes:

1. Vary selected overlap sizes and angles, and let a few boundaries disappear into the broad sheen.
2. Soften two or three repeated tear notches while preserving the readable gold-to-lacquer boundary.
3. Give the book’s top leaf a more decisive, delicate separation from its paper backing.

**Scene 6 — Practice/Mainnet: PASS**

The thinner, darker blue perimeter is less insistent. The bundle’s uneven offsets are visible at 2×, and the paper foreground plus explicit labels make the two states understandable.

The saturated blue well still attracts a strong first glance despite being the smaller background object. At phone size, the bundle’s modest edge variation compresses into a fairly solid block.

Priority changes:

1. Quiet the blue lining’s strongest contrast before reducing the perimeter further.
2. Introduce one subtle lifted or bowed top-paper edge; more parallel page lines would add little.

The foreground note’s crop is purposeful and does not impair the static reading.

**Pending-passkey art: PASS**

The thinner sidewall and closer bed improve this larger rendition too. The lighter ground shadow on light reduces the tablet’s apparent weight, while its narrow perimeter still defines it on dark.

The exposed black backing remains most noticeable under the bow. The large area of empty lacquer below the key also makes the tablet a substantial second object compared with Phantom P10’s compact authentication silhouette.

Priority changes:

1. Apply the same selective recess reduction as Scene 2.
2. Shorten the tablet’s unused lower portion or quiet that area further, concentrating attention on key, bed and tag.

There is no imitation scan or authentication progress. Its scale and placement within an actual pending screen remain unreviewed.

**Completion foil: PASS**

The impression’s unequal shading makes it belong more convincingly to the gold. The three retained creases now have adjacent tonal turns, and the lifted right corner has a visible thin underside cue. The former rectangular lattice is absent.

This remains the weakest material piece. The frame and glyph retain nearly continuous dark contours, so the impression still reads partly as a outlined stamp. The upper-right crease remains an isolated ridge on an otherwise broadly smooth surface; its painted turn does not yet describe a decisive fold.

Priority changes:

1. Interrupt the impression’s dark contour across the strongest light and strengthen one selective recess cue on the shaded side.
2. Connect the upper-right crease’s tonal turn to the surrounding bend, then shorten or fade its bright endpoint.
3. Make one broad bend agree more decisively across contour, highlight and shade, following S13’s material coherence.

Do not restore the lattice or add more wrinkles.

**Avatars — PASS for all twelve**

The collar openings now contain neck colour, including the previously conspicuous openings on **02, 05 and 09**. **06’s** tapered chin and cheek notches improve the beard silhouette; the former broad semicircular contour should not be carried forward unchanged as a criticism.

**06 remains the weakest individual:** its lower beard and mouth detail compress into one pale area at 48 px. Give it one clearer mouth separation or stronger selected cheek break; additional faint interior lines will have limited effect.

No other individual needs correction to retain PASS. The ornaments on **03**, glasses on **05**, earring on **08**, perimeter straps on **11**, and mask on **12** remain distinguishable in the small discs. Uniform face enlargement would reduce the useful differences already present.

**3. Cross-cutting defects that remain**

- **Thickness still accumulates locally.** The passkey’s recess, sidewall and shadow describe overlapping backing layers; tray channels contribute a similar effect.
- **Supporting objects remain too prominent.** Markets’ cases, Pending’s tablet and Mainnet’s blue well receive more emphasis than their instructional roles require.
- **Material geometry remains mechanically regular.** Kinpaku’s overlap rows, the paper bundle and several liquid reflections show their construction even after their contrast has been reduced.
- **Several scenes rely heavily on copy.** The balance chest and market collections establish subjects and brand character more directly than they explain useful trading or spending relationships.

Source compliance is sound within this inspection: all 20 masters contain named groups, no `<text>`, filters, raster images, scripts or animation elements; IDs are unique and paint/internal references resolve. The six base fields match the prescribed tokens, and the inspected BTC, MON and FX drawing primitives match their registered local assets. I see no invented quotes, returns, APY, scan/progress or additive capacity graphic.

The motion strips provide useful layer-separation evidence: passkey objects and shadows move independently, the LP drop and disturbance are separate, and completion exposes leaf, seal, sheen and flakes as distinct layers. They also show the limits of these aids: the LP frames do not establish convincing drop-to-surface contact, while the foil moves as a rigid sheet and its fixed sheen brightens and fades rather than visibly travelling across it. They demonstrate available layers, not accepted material motion, native rendering or device performance.

**4. What still separates this package from the references, and the three highest-impact next changes**

Solflare’s six scenes combine quiet interface shapes with selective dimensional accents; its illustrations communicate concrete relationships with fewer competing material treatments. Phantom P10 achieves authentication recognition through one compact dominant silhouette, while P01 maintains hierarchy despite a busy composition. Solflare S13’s contour, folds and highlights describe the same deformation more decisively than Senryo’s completion leaf. Senryo now has sufficient silhouettes and identity for the first-pass handoff, but still gives too many supporting surfaces similar borders, reflections and decorative finish.

The three highest-impact next changes are:

1. **Finish completion foil’s material logic:** make the impression and retained creases participate in one coherent bent surface.
2. **Reduce supporting-object emphasis:** begin with Markets’ inner tray channels, Pending’s unused tablet area and Mainnet’s blue lining.
3. **Finish the shared passkey construction:** resolve the remaining black ledge beneath bow and teeth, then soften the tablet reflection boundary. This improves two important pieces together.

## Earlier rounds

Kept for the trail of what was found and fixed. Later rounds supersede earlier ones.

### Round 4 verdict (verbatim)

**1. Overall verdict**

**PASS for the Round 4 static first-pass handoff: all nine pieces are now suitable for the user’s design review.** Completion foil clears the threshold because the rectangular lattice is no longer visible and the broad lighting reads continuously across the leaf. The package remains appreciably below Solflare/Phantom’s finish: accumulated edge thickness, repeated lacquer treatments and some mechanically regular details still weaken material conviction and visual economy. **B12 must remain open until the user’s own design review passes; these static renders also do not establish the motion and native acceptance required by [§5.10](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/docs/plan/v2-plan.md:643).**

**2. Per piece**

PASS means a static first-pass master good enough to hand to the user’s design review. I read all three earlier verdicts, the specified authorities, all ten reference frames, both scene sheets, each dark 2× scene, extras and both avatar sheets; I also inspected the masters and relevant scripts. No files were edited and no project builds were run. Phone chrome, controls, copy and label typography are mock/native context, as specified.

**Scene 1 — One balance: PASS**

The chest remains the clear source, both paths remain traceable, and neither destination loses its identifying seal. The destination outlines are thinner and their centres quieter; the chest’s broad shadow is sufficiently restrained. The card and koban now feel more closely related through their matching ground shadows.

The remaining weakness is the presentation of the destinations: the two closed ellipses still resemble display stations, while the paths resemble fine cords coming from the chest. The story is understandable, but the foreground remains more ceremonial than functional.

Priority changes:

1. Reduce the destination outlines another small step, particularly their dark edge. Let the objects and their shadows establish the destinations.
2. Simplify the path treatment into one restrained line so the relationship reads before its decorative construction.

**Scene 2 — Passkey: PASS**

The displaced second-key defect is resolved. The recess now follows the silver key closely enough that it reads as a bed beneath it. The phone remains recognizable and clear of the key.

The remaining dark mass beneath the bow and teeth combines recess, cast shadow and silver sidewall into considerable apparent thickness. Tablet and phone shadows are quieter, but their solid lower/right edges still contribute a layered backing effect. The tablet reflections are reduced, although their straight boundaries remain apparent at 2×.

Priority changes:

1. Reduce the combined dark mass beneath the bow and teeth. Preserve one convincing silver sidewall and a narrow recess cue.
2. Blend the tablet’s reflection boundaries more gently; preserve the phone’s clean silhouette and device cues.

**Scene 3 — Markets: PASS**

All three families are identifiable, and both FX names remain correctly associated with their flag pairs. The trays have more separation, their gold rims are gone, and their thickness and shadows are reduced. The embedded Bitcoin, MON and pair drawing primitives match the supplied local assets after normalizing whitespace and ID prefixes.

The trays still resemble three accessory cases. Their long dark outlines give the containers substantial visual weight, especially around the smaller commodities. The closer spacing is now acceptable; the remaining issue is container emphasis.

Priority changes:

1. Quiet the outer lips further, starting with the commodity tray. Let the metals and marks carry more of the contrast.
2. Reduce the repeated diagonal reflection and gold-dust treatment on the trays. Their shared construction already establishes a family.

Retain the demonstrated pair-label size and association during integration.

**Scene 4 — LP: PASS**

The lower hinge leaves now sit as foreshortened pieces on the rim. The door reflection is softer, and the differently interrupted ripples no longer form the earlier segmented target. The coherent base, recessed pool, aligned drop and front catch retain the vault reading.

The disturbance remains slightly diagrammatic: several similar-width arcs surround a crisp dark central oval. The large blue surface reads as liquid, but its local deformation is less convincing than the vessel around it.

Priority changes:

1. Make the impact asymmetrical: taper one near reflection, weaken another and soften the central oval’s edge.
2. Reduce the brightest hinge highlights slightly. They currently attract nearly as much attention as the liquid disturbance.

The former cooking-pot and pointed-base defects do not apply.

**Scene 5 — Kinpaku: PASS**

The card remains dominant, and its shorter shadow no longer creates the former conspicuous magenta backing silhouette. The torn boundary varies more convincingly, the supporting book has fewer, larger leaf divisions, and its fold underside is paler. The card’s foil sheen is now a named group in the master.

Two details still expose the construction. The card and book retain orderly quadrilateral overlaps, and the conspicuous pointed projection around the middle of the card’s torn boundary attracts attention independently of the foil. The book’s straight page stack also remains unusually rigid for such delicate material.

Priority changes:

1. Soften selected overlap seams on the book and card. Preserve readable overlaps without giving every sheet equal emphasis.
2. Shorten the longest pointed projection on the torn boundary and introduce a gentler change of direction nearby.
3. Give the book’s top leaf one clearer separation from its backing, rather than adding more page lines.

The raised-metal-tile criticism remains resolved.

**Scene 6 — Practice/Mainnet: PASS**

The paper foreground and explicitly named states make the lesson clear. The lining is deeper and less glossy, and the bundle’s close paper tones remove the previous hard stripe effect. Both metal contact shadows have named groups in the master.

The Mainnet tray still contains the strongest concentrated colour in the scene. Its blue well and bright perimeter can win the first glance before the larger paper foreground. The bundle is softer in tone, but its perfectly regular stepped corners still resemble a manufactured block.

Priority changes:

1. Lower the blue perimeter’s brightness slightly before further darkening the lining. Preserve clear Mainnet identity.
2. Vary two or three bundle-edge offsets subtly so the stack reads as paper without becoming untidy.

The labels resolve the mode distinction; gold is not being asked to carry that meaning alone.

**Pending-passkey art: PASS**

The bed alignment correction works here too. The key is the dominant silhouette, the tablet remains defined on dark, and the tag’s lighter shadow improves its appearance on light. There is no simulated authentication progress.

The larger extras render makes the remaining thickness beneath the bow especially apparent. On light, the tablet’s broad ground shadow also gives it more weight than the small tag and hovering-key pose suggest. The reflections are quieter, but the supporting slab remains a large decorative object compared with Phantom P10’s compact authentication silhouette.

Priority changes:

1. Apply the same bow/sidewall simplification as Scene 2.
2. Reduce the tablet’s broad ground-shadow density slightly while retaining its narrow dark-theme perimeter.
3. Quiet the tablet reflections before adding any further surface detail.

Placement within an actual pending screen remains unreviewed.

**Completion foil: PASS**

The Round 3 failure is resolved: I cannot see the rectangular cell lattice. Broad unequal light and shade now cross the sheet continuously, the seal stays readable, and the thin edge preserves the silhouette on light. The impression catch is also less uniform and less conspicuous than the earlier bevel-like outline.

This is still the least fully resolved material. The central frame and glyph read somewhat like a brown stamp laid over gold; the faint catches do not yet strongly establish a pressed recess. Several isolated pale crease lines read as scratches because the adjacent surface barely turns around them. The lifted right corner is understandable, but softly defined.

Priority changes:

1. Make the impression’s shading more responsive to the local gold: weaken the dark treatment on the lit section and retain a selective catch on the appropriate opposite edge.
2. Remove or shorten the least supported crease lines. For the retained creases, add a very restrained adjacent tonal turn.
3. Clarify the right corner with one small underside/shadow cue. Avoid restoring ribs, facets or extra wrinkles.

It now meets the handoff threshold, although S13 still describes deformation more decisively through its contour and highlight changes.

**Avatars — set: PASS**

The family remains distinguishable at 48 px. **11’s straps now stay at the face perimeter, and 12’s warm mask outline improves separation from the pale disc.** Neither warrants carrying forward the previous optical-balance objection.

Remaining weak pieces and priority changes:

1. **06:** Still the weakest. The new chin contour is visible at larger sizes, but the broad pale semicircle continues to resemble a face mask at 48 px. Refine the beard silhouette with a small cheek notch or tapered chin; another faint interior line will have limited effect.
2. **02, 05 and 09:** Small triangular neckline openings appear to show the disc colour through the clothing—most conspicuously lime on 02 and yellow on 05. Fill those openings with an intentional undershirt or neck continuation so they read as clothing rather than gaps.

03’s ornament, 05’s glasses and 08’s earring remain readable. Further uniform face enlargement is unnecessary.

**3. Cross-cutting defects that remain**

- **Thickness still accumulates.** Recess, sidewall, reflected edge and shadow sometimes describe several backing layers simultaneously. The passkey bow, tablet perimeter and Mainnet tray are the clearest remaining examples.
- **Lacquer still uses one recurring surface recipe.** Diagonal bands and gold dust recur across cards, tablets, trays and the vault. They establish consistency, but do too little to distinguish flat, recessed and curved surfaces.
- **Some detail remains mechanically regular.** Leaf overlaps, paper-stack offsets and ripple stroke widths remain more orderly than their materials suggest. Completion’s former lattice is resolved and should not remain on this list.
- **The instructional compositions still depend substantially on copy.** Scene 1’s display stations and Scene 3’s collections explain their subjects less directly than Solflare’s wallet, market-list and spending relationships.
- **Source compliance is substantially sound.** All 20 inspected SVGs contain no `<text>`, filters, raster images, scripts or animation elements; there are no duplicate IDs or unresolved paint references. The six base fields match the specified tokens, the reported sheen/contact-shadow groups exist, and I see no fabricated progress, quotes, returns, APY or additive capacity graphic.
- **Acceptance evidence remains bounded.** The sheets demonstrate static cropping, contrast and composition. They do not demonstrate native label binding, renderer parity, pending-screen placement, motion or J1 recovery behaviour.

**4. What still separates this package from the references, and the three highest-impact next changes**

The gap is now chiefly material direction and hierarchy. Solflare combines relatively quiet interface shapes with decisive dimensional accents; its completion flag’s contour, folds and highlights describe the same deformation. Phantom P10 achieves authentication recognition with one compact dominant shape, while P01 demonstrates that a busy composition can still have a clear hierarchy. Senryo gives many surfaces similar bevels, reflections and decorative detail, making supporting objects compete more than they should.

The three highest-impact next changes are:

1. **Finish the shared passkey material construction:** reduce the accumulated bow thickness and tablet backing edges in Scene 2 and Pending. This improves two important pieces together.
2. **Finish completion foil’s impression and crease logic:** keep the continuous lighting, then make the seal and retained creases belong more convincingly to that surface.
3. **Direct the lacquer treatment by surface and importance:** begin with Markets’ containers and Kinpaku’s supporting book. Reduce repeated decoration and reserve the strongest reflection cues for the principal object.

### Round 3 verdict (verbatim)

**1. Overall verdict**

**FAIL overall for the Round 3 static artwork handoff: eight of nine pieces pass; Completion foil still fails.** Scene 4 now clears the first-pass threshold: its base construction is coherent, and the pool reads sufficiently as liquid rather than a bullseye on a pot. The package is substantially closer to the references, but repeated lacquer containers, conspicuous backing edges and procedural surface artifacts still fall below Solflare’s material conviction and Phantom’s economical hierarchy. **B12 cannot close on this evidence:** the user’s own design review remains required, and these static renders do not establish motion or native acceptance under [§5.10](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/docs/plan/v2-plan.md:643).

**2. Per piece**

PASS means a **static first-pass master good enough to present to the user’s design review**, not production approval. I read both earlier verdicts first, then inspected all ten requested reference frames, both scene sheets, each of the six dark 2× detail renders, extras, both avatar sheets, masters and relevant scripts. This reviews the current `art-j1` working files on `stage/S1b-art`, base `c3a1af0`; no files were edited and no project builds were run.

**Scene 1 — One balance: PASS**

The two branches remain traceable from the chest, and the card seal remains uncropped. The black pedestals are gone; the ground paths no longer have offset cast shadows.

Remaining changes, in priority order:

1. **Quiet the destination rings.** Their bright gold outlines and dark channels still resemble the bezels of two display platforms. Reduce outline contrast and channel width so the hovering objects carry more attention.
2. **Reduce the chest’s broad brown shadow.** Its tight contact is useful, but the large rightward stain competes with the trading branch.
3. **Make the hovering poses feel related.** The card and upright dish still look separately presented beneath the chest. Tune their elevation and shadow spread together, preserving both visible connections.

The previous pedestal defect is resolved; the remaining display-case feeling is weaker.

**Scene 2 — Passkey: PASS**

The key remains immediately recognizable, and the device cue is clear. The two-tone sidewall is simpler, and the tablet/phone shadow throws are shorter.

Remaining changes, in priority order:

1. **The recess still reads as a second key.** Its fill is faint and its outline treatment has changed, but the exposed dark bow, shaft and teeth remain a complete, displaced silhouette at phone size. Hide more of it beneath the silver key or suppress the exposed bow and teeth further.
2. **Reduce the blue backing effect beneath the tablet and phone.** Shorter shadows help, but the lower/right bands still resemble additional solid layers.
3. **Soften reflection boundaries according to the surface.** The tablet’s reduced bands remain straight graphic stripes, while the silver bow retains a slightly stacked edge.

The recess correction is only partially successful visually; removing a continuous outline has not removed the competing silhouette.

**Scene 3 — Markets: PASS**

All three market families read clearly. The commodities now clear the tray lip, and the larger pair plates and approximately 12-point native-context labels materially improve identification. Inspection confirms that the embedded Bitcoin, MON and pair path geometry is preserved from the supplied local assets.

Remaining changes, in priority order:

1. **Reduce container emphasis further.** White rim, gold rim, dark inset and black thickness still combine into three phone-case-like objects. Keep one dominant rim cue and quiet the others.
2. **Reduce the yellow shadow halos**, particularly below the FX and crypto trays. These remain conspicuous despite their shorter reach.
3. **Give the tray overlaps cleaner breathing room.** Their near-touching edges make the composition feel tightly stacked. A little more separation would strengthen the three-family reading without reducing label size.

The commodity clearance and label corrections are resolved. The named contact-shadow groups are present for the resting objects.

**Scene 4 — LP: PASS**

The pointed base joins are gone: the wall now meets one fitted plinth. Broken near-side highlights, darker far-side arcs, a small dimple, front meniscus and soft glare establish enough liquid depth for this threshold. Both hinges visibly have two leaves and a knuckle, and the drop sits clearly between them above its impact.

Remaining changes, in priority order:

1. **Break the ripple pattern’s regularity.** The same angular interruptions recur at successive radii, so the disturbance still resembles a segmented target at 2×. Vary break positions, taper the catches and reduce the far arcs’ contrast.
2. **Seat the lower hinge leaves more convincingly on the rim.** They remain upright rectangular plates against a curved, receding ledge. Foreshorten them to follow that surface.
3. **Soften the door’s broad gray reflection arc.** It reads as a painted band more than reflected light on curved lacquer.

These are refinements now. I would not carry forward the round-2 construction failure or describe the pool as complete outlined ellipses.

**Scene 5 — Kinpaku: PASS**

The card remains the clear subject. The crumb trail is visibly sparser, the shadow is tighter, and the book corner has a curved fold rather than the former sharp triangular construction. The card sheen has a named path, and the tweezers’ shadow has a named group.

Remaining changes, in priority order:

1. **Fade the remaining magenta shadow border.** Along the card’s lower/right edge it still resembles another thickness layer.
2. **Quiet the book’s square pattern and dark fold underside.** The supporting leaf still looks more geometrically assembled than the card’s foil. Preserve sheet overlaps, but reduce their regularity and contrast.
3. **Make the card’s torn boundary less uniformly serrated.** The reduced crumbs help, but the repeated angular bites still expose the authoring pattern.

The raised-metal-tile criticism no longer applies. The material is reviewable applied leaf, with procedural regularity still visible.

**Scene 6 — Practice/Mainnet: PASS**

Practice occupies the foreground, and both states are explicitly identified. The smaller blue tray and deeper lining improve the hierarchy. The loose note reads appreciably thinner, and the Mainnet label is now properly aligned beneath its tray.

Remaining changes, in priority order:

1. **Reduce the lining’s remaining saturated highlight slightly.** The blue tray still wins the first glance despite the Practice-first story; retain its blue identity while giving the paper foreground more optical priority.
2. **Quiet the bundle’s repeated beige page edges.** Their contrast makes the stack look stiff and manufactured compared with the thinner loose note.
3. **Preserve the labels at their demonstrated size and association.** Their current placement resolves the earlier alignment issue; integration must retain that relationship.

Gold is no longer carrying the mode distinction by itself. The former heavy loose-note edge is substantially resolved.

**Pending-passkey art: PASS**

The silver key dominates on both grounds, and the reflected tablet perimeter remains readable on dark. The light tag shadow is softer, and the cord shadow is separately named.

Remaining changes, in priority order:

1. **Apply the Scene 2 recess correction here.** The exposed black bow and teeth still read as a second key, especially in the larger extras render.
2. **Reduce the tag’s remaining dark lower/right halo on light.** Its solid extrusion and shadow still accumulate into a heavy little backing shape.
3. **Quiet the tablet’s diagonal reflections further.** Phantom P10 achieves clearer authentication imagery with fewer competing surface cues.

There is no fabricated scan or progress. The static pose is reviewable; the extras sheet does not demonstrate its placement inside an actual pending screen.

**Completion foil — FAIL**

The old narrow ribs are gone. Broad shading, partial-opacity impression shading, the thinner frame and gentler lifted corner are visible improvements; the corner’s separate shadow helps on light.

The replacement surface still exposes its construction:

1. **Remove the visible rectangular cell lattice.** It is apparent across the upper-left amber area and through parts of the central sheet. This is a different artifact from round 2’s diagonal ribs, not the same criticism carried forward. The independent cell gradients and sheen in [foil.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/foil.py:145) have not produced visually continuous paint.
2. **Refine the impression’s edge lighting.** Gold variation now survives beneath the shade, but the consistent pale lower/right catches still give the frame and glyph a bevel-effect appearance. Vary their strength with the local surface rather than maintaining an even keyline.
3. **Let fewer, broader turns define the leaf.** Once the lattice is removed, retain the restrained creases and thin edge; additional wrinkles or flakes would only conceal the problem.

The mesh artifact keeps this below the material-plausibility threshold. The answer is continuous surface lighting, not a larger curl or more decoration.

**Avatars — set: PASS**

The current family is readable at 48 and 96 pixels. **11’s face is larger and its brim no longer compresses the eyes; 06’s eye arcs clear the frames; 12’s smaller, outward mask no longer dominates the wearer.** The specified `#F5F4F8` robe and `#ECE9F2` ground are present and match current palette tokens.

Individual refinements, in priority order:

1. **06:** The beard’s broad, smooth pale bowl can resemble a mask at the smallest size. Add one restrained contour break or clearer chin shaping; the earlier crowded-eye objection is resolved.
2. **11:** The two purple straps remain stronger than much of the expression and cut across both cheeks. Reduce their contrast or move them toward the face perimeter. Further uniform face enlargement is unnecessary.
3. **12:** The mask’s outer-left silhouette has weak separation from the pale disc. Strengthen only that edge subtly, without restoring the mask’s former size or adding internal detail.

03 and 07 remain distinct; 05’s glasses and 08’s earring remain legible. There is no reason to restart the set.

**3. Cross-cutting defects that remain**

- **Thickness and shadow still accumulate.** Several objects combine solid extrusion, a reflected rim and an offset shadow into multiple visible backing layers. Scene 2, Scene 3, Kinpaku’s lower edge and the pending tag remain the clearest examples.
- **Lacquer relies too heavily on one recipe.** Diagonal reflection bands, fine gold rims and gold dust recur across tablets, trays, cards and vault surfaces. Reflection shape should distinguish flat card, recessed tray and curved vessel more clearly.
- **Some procedural patterns remain visible.** Completion’s cell lattice is the blocker; LP’s repeated arc interruptions, Kinpaku’s serrated boundary and the book’s square arrangement are lesser instances.
- **Layer separation is substantially improved, with small gaps remaining.** Scene 3’s contacts, the cord shadow and tweezers’ shadow are named. Scene 6’s metal contact shadows remain inline within the tray, and the card sheen is a named path rather than a dedicated semantic group. These are handoff refinements, not reasons to fail the static compositions.
- **The supplied evidence has a defined limit.** The six artwork fields match the six specified tokens. The inspected masters contain no `<text>`, filters, duplicate IDs or embedded raster images; I saw no invented quotes, APY, additive capacity pie or authentication progress. Phone chrome, controls and label typography are sheet context. Motion, native renderer parity and actual J1 behaviour remain unreviewed.

**4. What still separates this package from the references, and the three highest-impact next changes**

The remaining gap is primarily material direction and visual economy. Solflare’s scenes combine a readable feature relationship with a small number of strongly resolved material accents; S13’s contour, folds and highlights describe the same surface. Phantom P10 establishes authentication with one dominant lock silhouette. Senryo’s story is now understandable, but repeated containers, doubled silhouettes and decorative surface treatments still demand more interpretation.

The three highest-impact next changes are:

1. **Finish Completion foil:** eliminate the cell lattice, then make the impression catches follow the continuous leaf lighting. This is the remaining static failure.
2. **Simplify the shared passkey composition:** suppress the exposed second-key silhouette and reduce accumulated backing layers in both Scene 2 and Pending.
3. **Refine the shared lacquer/shadow treatment:** quieter rims, tighter contact and surface-specific reflections, starting with Markets and Kinpaku. Preserve the improved labels, story relationships and distinct LP construction.

### Round 2 verdict (verbatim)

**1. Overall verdict**

**FAIL overall; B12 should remain open.** Round 2 materially improves the package: seven of nine pieces now clear the threshold for a static first-pass master presented to the user’s design review. Story clarity is much closer to the references, but the repeated lacquer slabs, conspicuous shadow silhouettes, and procedural foil texture still fall below Solflare’s material conviction and Phantom’s economical hierarchy. The LP vault and completion foil remain the two failing pieces.

**2. Per piece**

PASS below applies to the static artwork handoff. I inspected the round-1 verdict, all ten requested reference frames, both theme sheets, all six dark 2× phones, extras, both avatar sheets, and relevant masters/scripts; no files were edited and no builds were run.

**Scene 1 — One balance: PASS**

Both branches can now be traced from the chest, the card seal is fully visible, and the smaller trading dish lets the chest remain the source. The instructional omission from round 1 is resolved.

The remaining weakness is physical language: the ground paths look like gold-edged cables because they have dark borders and offset shadows. The card and upright dish hovering above matching plinths also give the foreground a display-case feeling.

Priority changes:

1. Flatten the ground paths into the field: remove their offset cast shadow and reduce the black channel width so they read as inlay.
2. Simplify the trading destination’s repeated rings—the dish plus its pedestal—and lower pedestal contrast.
3. Preserve the current visible connections and uncropped seal.

**Scene 2 — Passkey: PASS**

The phone is clear of the key, and the distracting junction sparkle is gone. The silver key remains immediately recognizable.

The recess is quieter in fill, but its exposed bow, shaft, and teeth still form a conspicuous second black key. Below the tablet and phone, the broad blue shadow silhouettes still resemble additional backing layers. The silver bow also shows several discrete extrusion contours.

Priority changes:

1. Reduce the recess’s continuous dark outline, particularly around its exposed bow; let a restrained shaded edge establish the hollow.
2. Shorten and lighten the tablet/phone shadow throws while retaining tight contact.
3. Blend the key’s solid sidewall into fewer tonal regions without losing its thickness.

**Scene 3 — Markets: PASS**

Commodities, FX, and crypto now receive readable, comparable emphasis. Both pair names are present and correctly associated with their flag pairs. The embedded Bitcoin, MON, EUR/USD, and JPY/USD path geometry matches the supplied source assets.

The new compositional cost is container repetition: three heavily rimmed lacquer trays resemble stacked phone cases. Their edges and yellow shadow halos consume substantial attention. The FX tray is larger than the others, although the difference is understandable because it contains labels.

Priority changes:

1. Reduce rim thickness and shadow reach across all three trays; make the identities dominate their containers.
2. Give the commodities more clearance from the tray lip—the koban presently crosses its lower rim.
3. Increase the pair-label type slightly from the current approximately 10.5-point mock size, preserving native text and the existing associations.

The missing-name and tiny-FX defects from round 1 are resolved.

**Scene 4 — LP: FAIL**

The hinges, radial bolts, front catch, and fitted circular door retire the cooking-pot criticism. One drop is visibly aligned with one disturbance.

Two defects still prevent handoff. At both lower sides, the base rises into pointed fins where the plinth and cylindrical wall meet; those joins break the object’s construction. The pool still reads mainly as a smooth blue fill with three outlined ellipses and a white central oval—a bullseye drawn on a surface, rather than displaced liquid. Far-wall shading provides depth, but the meniscus does little visible work.

Priority changes:

1. Repair the wall/plinth joins into one continuous, fitted base. The relevant construction is in [scene_lp.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/scene_lp.py:35).
2. Replace the complete concentric outlines with a localized disturbance: softer, interrupted reflection arcs and a smaller central displacement.
3. Strengthen the liquid’s contact with the inner wall and connect the hinge hardware more convincingly to both door and well.

Keep the new vault construction; another wholesale metaphor change is unnecessary.

**Scene 5 — Kinpaku: PASS**

The conspicuous bevel seams are gone. The card now reads credibly as lacquer with applied gold sheets, and the smaller book supports the craft story without displacing the card.

The regular square layout remains apparent, especially on the book. The six free flakes are restrained, but the dense crumb trail along the card’s torn boundary still competes with the seal. The magenta shadow beneath/right of the card remains a substantial second silhouette.

Priority changes:

1. Tighten the card’s shadow further; its current throw exaggerates elevation.
2. Reduce the attached crumb trail, particularly the larger fragments along the middle of the torn edge.
3. Vary and soften a few sheet overlaps on the book, and soften its sharply triangular corner fold.

These are refinements now; the former raised-metal-tile reading is no longer the dominant problem.

**Scene 6 — Practice/Mainnet: PASS**

The two states are explicitly named, Practice occupies the foreground, and the blue-lined tray carries Mainnet identity. Gold is no longer being asked to distinguish the mode by itself. Gray also gives the paper clearer separation than the former yellow field.

The saturated Mainnet blue pulls attention strongly despite the Practice-first headline. The loose note’s gray lower edge and shadow make it look thicker than a single sheet. The Mainnet label hangs noticeably left of its object.

Priority changes:

1. Reduce the blue tray’s visual dominance slightly through scale or highlight intensity while retaining its mode colour.
2. Thin the loose note’s edge and tighten its shadow so it clearly differs from the banded bundle.
3. Bring the Mainnet label into closer alignment with its tray.

The native-label anchors are present in [labels.json](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/art/onboarding/labels.json).

**Pending-passkey art: PASS**

The tablet’s lower/right reflected rim now preserves its silhouette on dark, and the tag perimeter remains readable. Key and key shadow have separate named groups; cord and tag plate are also addressable.

The exposed recess still reads as a second key. On light, the tag’s gray shadow forms another fairly hard silhouette, and the tablet’s diagonal reflection bands are more graphic than material.

Priority changes:

1. Apply the Scene 2 recess correction here as well.
2. Soften and shorten the tag shadow on light.
3. Reduce the sharper tablet reflection bands; retain the improved dark rim.

The composition remains legible at rest and contains no fabricated authentication progress.

**Completion foil: FAIL**

The broad unequal bends, thinner edge, calmer seal placement, and reduced flakes are visible improvements. The former large corrugations are gone.

However, fine, regularly spaced diagonal ribs remain across much of the sheet. They expose the strip construction and give it a ribbed texture rather than convincing beaten leaf. The seal is readable, but its consistently dark fill and cream offset outline still resemble an applied graphic with a bevel effect; they do not convincingly follow the surrounding gold’s changing surface response. The rightmost lifted corner reads more as an angular tab than a clear curl.

Priority changes:

1. Make neighbouring strips share continuous edge colour and sheen opacity, or use a continuous clipped paint field. Preserve the broad bends while removing the regular ribbing.
2. Shade the impression relative to the local gold surface; reduce the heavy frame and confine bright catches to appropriate edges.
3. Resolve the lifted corner with a small, coherent underside/shadow cue.

The remaining strip and seal treatments are visible in [foil.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/foil.py:152). This is closer, but it still lacks S13’s convincing relationship between surface deformation, highlight, and silhouette.

**Avatars — set: PASS**

The enlarged faces, stronger glasses, readable hairpin, simpler hat, and simplified mask make this a reviewable portrait family. **03 and 07 are now distinguishable; 05’s glasses read and its green robe is gone; 08’s earring survives the small size.** Those round-1 defects should not be carried forward.

Individual weak pieces, in priority order:

1. **11:** Still the weakest optical balance. Its face is approximately 22 pixels wide at the 48-pixel size, and the brim compresses the eye/forehead area. Enlarge the face independently and raise or shallow the brim slightly; retain the simplified ribs.
2. **06:** Closed-eye arcs inside heavy circular glasses create a crowded double-loop pattern at 48 pixels. Shorten the eye arcs and increase their clearance from the frames. Improve beard separation from the gray ground.
3. **12:** The simplified mask is recognizable, but its white mass still attracts attention before the wearer’s face. Reduce it modestly and move it outward while retaining the clear sleepy expression.

The remaining faces are sufficiently distinct for this first-pass set. Further variation should target individual facial proportions, not another uniform enlargement.

**3. Cross-cutting defects that remain**

- **Shadow improvement is partial.** The 16-layer easing and radial broad shadows are present, but several objects still carry conspicuous offset silhouettes. Layer count alone has not delivered soft falloff. The largest offenders are Scene 2’s tablet/phone, Scene 3’s trays, Scene 5’s card, and the light pending tag.
- **Lacquer treatment repeats too mechanically.** Diagonal reflection strips, gold dust, dark extruded edges, and fine rim lines recur across nearly every object. Reduce their contrast and vary reflection shape according to each surface’s curvature. Scene 3’s three-container arrangement increases this repetition.
- **Independent controls are improved but incomplete.** Major shadows are separated, and LP pool/ripples/drop/door are named. Some market-object contact shadows remain unnamed; the cord/tweezers shadows are bundled with their objects; Kinpaku’s foil sheen lacks a dedicated named group. Native labels also need to remain bound to their corresponding objects when integrated.
- **The all-token avatar claim is only partly verified.** The cyan and rose grounds are existing chart tokens, and 05 uses an approved blue robe. However, 07’s robe and 12’s ground use the custom `PAPER["mid"]` ivory rather than a current palette token. Reconcile that small exception explicitly.
- **The principal truth boundaries hold.** The six fields have the stated assignment. I found no SVG `<text>`, filters, duplicate IDs, fake quotes/APY, capacity pie, or authentication progress. These static sheets establish neither native rendering parity nor motion acceptance.

**4. The three highest-impact changes overall**

1. **Finish the LP vault’s construction and liquid:** eliminate the pointed base joins, then replace the bullseye rings with a convincing localized disturbance.
2. **Finish the completion foil:** remove regular strip ribbing and make the pressed seal respond to the same surface lighting as the leaf.
3. **Refine the shared shadow and lacquer treatment:** shorter throws, quieter rims, and surface-specific reflections would improve most of the passing pieces simultaneously.

### Round 1 verdict (verbatim)

**1. Overall verdict**

**FAIL overall; B12 should remain open.** The package has dimensional objects, but it remains substantially below the references in material plausibility and clarity of the six-scene story. Scene 2 and the pending-passkey composition clear the first-pass threshold; the other pieces need revisions beyond polish. Solflare’s scenes establish distinct relationships between objects, while several Senryo scenes read as arrangements of branded collectibles; Phantom achieves clearer recognition with fewer competing shapes. I inspected all requested reference frames, both theme sheets, all six 2× phones, the extras, both avatar sheets and the source; no files were edited and no builds were run.

**2. Per piece**

PASS here means an acceptable **static first-pass master for design review**, not production, motion or J1 acceptance. The governing requirements are the [six-scene composition table](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/docs/design/reviews/2026-10-01-mobile-ux-review.md:255) and [Living Lacquer material rules](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/docs/design/senryo-v2/direction.md:70).

**Scene 1 — One balance: FAIL**

**Defects:** The chest reads clearly as a lacquer money chest, but “one balance serving trading and spending” does not read clearly. The trading connection is almost entirely hidden beneath the upper-right dish; the long dotted spending trail reads as decoration. The card’s identifying seal is partly clipped at the left edge. Chest, dish and card also use noticeably different viewing angles, weakening the impression of one composed space. These problems persist in both themes because the hero is unchanged.

**Changes, in priority order:**

1. Make both connections visibly continuous from the same chest to their destinations. Keep them restrained, without amounts, partitions or simultaneous allocation.
2. Move the card enough to retain its seal and recognizable silhouette; crop an unbranded edge instead. Reduce the dish’s visual weight so the chest remains the unmistakable source.
3. Align viewpoints and shadow directions. Shorten the chest’s broad brown shadow and give it a tighter contact shadow.

**Scene 2 — Passkey: PASS**

**Defects:** The silver key and phone communicate the subject at phone size, without simulated authentication. The principal weakness is the nearly black key-shaped bed: its offset silhouette competes with the silver key and can look like a second key. The tablet and phone shadows have visible stepped bands at 2×. The large white sparkle at the key-tip/phone junction obscures the separation between those objects.

**Changes, in priority order:**

1. Make the bed a quieter recessed shape: lower its contrast and emphasize one inset edge rather than a complete black silhouette.
2. Reduce and reposition the large junction sparkle; preserve a clean gap between key and phone.
3. Replace the stepped shadow bands with smoother falloff and expose the key’s cast shadow separately from the key.

These are refinements to an already readable first-pass composition.

**Scene 3 — Markets: FAIL**

**Defects:** The marks are sourced correctly: Bitcoin, MON and the flags are embedded from registered assets, not invented logos. However, **EUR/USD and JPY/USD are never named** in the shown composition, contrary to the pair-identification requirement. The gold object and Bitcoin dominate; FX reads as tiny peripheral flag decorations. The large tray consumes substantial space without explaining market breadth. Its stacked dark edge and offset shadow also make it resemble several nested cases.

**Changes, in priority order:**

1. Supply explicit placement anchors for native **EUR/USD** and **JPY/USD** labels. Keep text outside the SVG master.
2. Recompose commodities, FX and crypto into three readable clusters with comparable emphasis. Give the pair objects more room and reduce the tray.
3. Establish a shared resting plane for koban/chōgin and a consistent elevation for the floating badges. Simplify the tray edge and tighten its contact shadow.

Preserve the original entity artwork and colours throughout.

**Scene 4 — LP: FAIL**

**Defects:** The tapered vessel, removable round lid and central silver knob read as a cooking pot. The lid also looks too small to close the vessel. The liquid has some depth from the far-wall shading, but the white splash and concentric rings read as diagram strokes over an opaque coloured surface. Three disconnected drops do little to explain a shared liquidity pool. The lime field is permitted artwork colour; it is not itself a green-semantic violation.

**Changes, in priority order:**

1. Keep the reservoir concept, but give it vault-specific construction: a fitted recessed cover, latch or hinge. Remove the kitchen-style knob and match the lid to the opening.
2. Add a clear meniscus, reflected rim and localized disturbance. Reduce the diagram-like rings and simplify the splash.
3. Use one deliberate incoming drop aligned with its impact point. Let the vessel and shared surface carry the story without suggesting growth or guaranteed withdrawal.

**Scene 5 — Kinpaku: FAIL**

**Defects:** The card has recognizable proportions and a readable seal, but the gold surface looks like **raised metal tiles or panels**, rather than thin applied leaf. Strong light/dark seams and triangular reflections give each square apparent thickness. The accompanying leaf book repeats that construction, reinforcing the wrong material reading. Broad magenta shadow bands make the card appear excessively elevated. Numerous large floating fragments compete with its outline.

**Changes, in priority order:**

1. Flatten the apparent leaf seams: remove bevel-like edge pairs, reduce seam contrast and use irregular overlaps with one coherent directional sheen.
2. Make the leaf on the book visibly thin, including its lifted corner. Reduce the book’s contrast and scale so it remains a supporting craft cue.
3. Tighten the card’s contact shadow and remove roughly half the floating fragments, especially those touching its right silhouette.

Retain the current card proportions and restrained seal; neither needs a wholesale redesign.

**Scene 6 — Practice/Mainnet: FAIL**

**Defects:** The foreground paper money reads immediately, but the second state reads as “gold coin,” not “Mainnet.” Its thin blue dish ring cannot carry that distinction at phone size. The composition therefore makes gold the most conspicuous identifier of real-money mode, conflicting with the rule that gold does not mean Mainnet. Neither material state has a visible label. Reusing Scene 1’s upper-right koban dish also makes this feel like another wealth illustration instead of a deliberate mode lesson.

**Changes, in priority order:**

1. Provide native label anchors for **Practice — paper money** and **Mainnet — real money**, retained in the static composition. No SVG `<text>`.
2. Give Mainnet a substantial blue-accented lacquer account object. If the koban remains, make it a secondary commodity detail rather than the mode identifier.
3. Simplify the paper stack to one bundle and one loose note. Increase separation between the two states and reduce the heavy yellow-brown shadow.

Do not introduce a visual switch that implies the account changes mode automatically.

**Pending-passkey art: PASS**

**Defects:** The silver key remains the clear focal object on both grounds, and the artwork contains no scan, completion fill or fabricated progress. On dark, however, the tablet’s lower/right perimeter and tag lose definition. The black bed again competes with the key. The key group includes its cast shadow, limiting independent movement of those two elements.

**Changes, in priority order:**

1. Add a restrained reflected rim to the dark tablet and strengthen the tag’s perimeter, while retaining lacquer’s dark body.
2. Quiet the bed and simplify the glints so the key remains the single dominant silhouette.
3. Separate key, key shadow and cord attachment into independently addressable groups. Preserve an intentional static pose for Reduced Motion.

The extras sheet supports this first-pass verdict; it does not establish acceptance inside an actual pending screen.

**Completion foil: FAIL**

**Defects:** The sheet reads as thick, regularly corrugated metallic fabric. Its repeated narrow bands reveal the strip construction rather than irregular beaten leaf. The lower edge has substantial apparent thickness. The dark seal reads as printed ink with a bright offset outline, rather than a convincing pressed impression; its central shape becomes difficult to recognize across the strongest bend. On light, the broad ground shadow makes the sheet feel heavy. Solflare S13 achieves a much cleaner dominant silhouette and material fold.

**Changes, in priority order:**

1. Replace regular corrugation with two or three broad, unequal bends plus sparse localized creases. Blend adjacent strip tones to suppress visible construction bands.
2. Make the edge thinner and place the seal on a calmer part of the surface. Use restrained impression shading instead of the conspicuous bright duplicate outline.
3. Reduce the ground shadow and loose flakes. Keep the highlight layer separable and tied to the surface’s folds.

A pole or literal Solflare flag is unnecessary; the foil adaptation needs equivalent material conviction.

**Avatars — set: FAIL**

**Defects:** The twelve silhouettes are distinguishable, but face variation is mostly a shared head with interchangeable features and accessories. The [shared face outline](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/avatars.py:9) is only 100 units wide on a 256-unit canvas: approximately **19 px of face width at 48 px**. That leaves too much shoulder/background and too little room for identity-defining features compared with Phantom’s bold avatar treatment.

Individual weak pieces:

- **03:** The fine hairpin and dangling ornament largely disappear at 48 px; the face closely resembles 07.
- **05:** Thin glasses compete with small dark eyes. Its [green robe](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/avatars.py:34) violates the supplied nonfinancial green restriction.
- **06:** Small glasses, brows and beard compress into a crowded cluster.
- **08:** The earring nearly disappears, while the small eyes and mouth leave expression poorly resolved.
- **11:** The oversized hat suppresses the face; fine weave and stubble become noise at 48 px.
- **12:** The mask’s internal details collapse, while its bright mass competes with the wearer’s face.

**Changes, in priority order:**

1. Enlarge faces and reduce shoulder area; aim for roughly 25–28 px face width at 48 px while preserving headwear inside the circular crop.
2. Vary jaw, cheek, nose and head proportions across the cast. Give 03 and 07 clearly different facial construction.
3. Simplify accessories for their smallest size: thicker glasses, fewer hat ribs, a larger hairpin ornament and fewer mask markings. Replace 05’s green robe with approved violet/lacquer colours.

The unchanged full-colour discs behave consistently across dark/light; switching themes does not repair their small-scale legibility.

**3. Cross-cutting defects**

- **Shadow construction:** The [eight stacked strokes](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/kit.py:163) produce visible bands around tablets, cards and trays. Reduce shadow reach, strengthen tight contact and use smooth radial falloff for broad shadows.
- **Light and viewpoint:** Upper-left lighting is broadly followed, but specular bands, extrusion offsets and object viewpoints do not consistently describe the same space. Define a common camera/light convention, then adjust each material’s response.
- **Material identity:** Lacquer repeatedly uses the same diagonal reflection strips and gold dust. Gold alternates between embossed coin, raised tiles and corrugated sheet without a convincing distinction between those constructions.
- **Scale and repetition:** Scenes 1 and 6 reuse essentially the same upper-right dish composition. Scenes 2 and Markets both rely on large dark rounded slabs. More distinct silhouettes and object relationships are needed across the sequence.
- **Palette:** The six permitted fields are present. Their changed order is not expressly prohibited by the authorities. The weak assignments are gray Markets, which reinforces a static display-tray reading, and yellow Practice/Mainnet, where pale paper relies heavily on outlines. Separately, the authors introduced additional material colours and avatar pigments; those need explicit palette reconciliation, especially the green robe.
- **Animation separation:** Named top-level groups exist, but some object shadows are bundled with the moving objects, and LP’s liquid/ripples remain nested within the main layer. Naming broad layers alone does not provide all the required independent controls.
- **Verified boundaries:** No `<text>`, filters, fabricated quotes, APY, additive capacity pie or authentication progress appeared in the masters. Rounded clipping and stable controls are demonstrated by the sheet script, not established as production behaviour. Motion samples and native renderer parity remain unreviewed.

**4. The three highest-impact changes overall**

1. **Repair the instructional relationships in Scenes 1, 3 and 6:** visible shared-balance connections, named FX pairs and explicitly labelled Practice/Mainnet states.
2. **Replace the shared shadow/material treatment:** smooth contact shadows, thin overlapping gold leaf and irregular completion-foil bends will improve most of the package at once.
3. **Recompose the weakest silhouettes:** turn LP’s cooking pot into a purposeful vault and enlarge avatar faces before investing in additional texture or animation.

## Card face and seal — round 7 verdict (verbatim)

**1. Overall verdict**

**The Kinpaku card front now PASSes as a first-pass master for the user’s design review.** The canonical seal is restored, the tear no longer has the previous thick continuous outline, and the flat card’s lacquer reflection is substantially quieter. The back, seal, shown variants/app icon and scenes 1, 5 and 6 retain PASS, with the remaining defects below. This was read-only, with no project builds; these verdicts cover static artwork and do not close B12 before the user’s design review.

**2. Per piece**

**Kinpaku card front — PASS**

The heavy frame, hairline frame and 千 now match the primary carving. The source uses [carved_seal](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/kit.py:286), and the generated card contains the canonical glyph path. The finer, broken-shade boundary now suggests thin applied leaf sufficiently for this acceptance bar. The number remains clearly readable on both grounds.

Remaining changes, in priority order:

1. **Resolve the overlay’s cramped bottom row in the app.** “CARD HOLDER EXPIRES” nearly reads as one caption, and even the ordinary sample holder truncates. The artwork provides additional lacquer to the left: use that space to widen the holder column while preserving a clear gutter before expiry. This is an integration defect, not grounds to reject the art master.
2. **Correct the mock’s typography before treating it as an exact app reproduction.** The layout positions and truncation intent match, but [sheets.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/sheets.py:178) uses Medium for labels and SemiBold for holder/expiry; the app’s tokens specify SemiBold labels and Medium small numbers. The sheet therefore demonstrates the arrangement, not exact native text widths.
3. **Break the remaining tiled regularity.** Across the lower gold field, similarly sized rectangular overlaps still form conspicuous rows. Vary selected sheet dimensions and angles, and lose several seams into the sheen.
4. **Refine the central fragment cluster.** The closely packed polygon chips beside the middle tear still resemble decorative confetti more than fragile leaf. Make several smaller or more slender and reduce the cluster’s density.

The previous seal inconsistency and thick-edge defects should no longer be carried forward as unresolved failures.

**Kinpaku card back — PASS**

The narrow horizontal leaf field, lower-left naming and lower-right seal remain sufficient for a coherent reverse. The lacquer silhouette survives dark ground; light ground gives it a clear boundary.

Remaining changes, in priority order:

1. **Bring the band’s edge treatment closer to the front.** Its thin but continuous brown perimeter remains visible, particularly along the lower edge. Interrupt that shade rather than outlining the entire strip.
2. **Reduce construction detail inside the narrow band.** Repeated overlaps and numerous diagonal hairlines become busy within such a shallow area. Remove selected scratches and let more seams disappear.
3. **Further soften the long lacquer reflection boundaries.** They remain recognizably straight diagonal edges, although sufficiently subdued to retain PASS.

**Seal — primary, including small sizes — PASS**

At 96 and 48 px, both frames and the glyph are distinct. At 32 and 24 px, 千 remains recognizable on both grounds, but the hairline frame becomes uneven and the carved-edge catch largely disappears. That limitation has **not** been fixed by standardizing the carving.

Remaining changes, in priority order:

1. **Correct the documented small-size rule.** Contrary to the supplied change description, [README.md](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/README.md:114) still says “full seal 24 px” and directs only smaller sizes to the favicon. Change it to the intended below-32-px routing. The existing simplified favicon is the appropriate available treatment; another master redraw is unnecessary for this pass.
2. **Improve large-size material specificity.** The smooth diagonal gradient and continuous bevel still suggest a brass plaque more strongly than gold leaf. Introduce restrained variation in the reflected light and soften the uniformly enclosed bevel while preserving the carving.

**Seal variants and app icon — PASS for the shown uses**

The inverse retains clear gold carving against lacquer. The pale mono is readable on dark ground, and the light-ground favicon gives the glyph sufficient space. The icon’s centred seal remains identifiable within its dark field.

Remaining changes, in priority order:

1. **Show the existing favicon at 16 and 24 px in the next sheet.** Its current large presentation does not demonstrate the small-size route being prescribed.
2. **Validate the icon under actual platform masks and at home-screen size.** The unchanged 58% seal scale leaves a relatively quiet mark within generous margins. That remains adequate for this first-pass master, but the sheet’s square preview does not settle its final optical size.

The light row substitutes the favicon for mono; it does not demonstrate a light-ground monochrome variant. The separate wordmark redesign remains unresolved and receives no new acceptance here.

**3. Scenes 1, 5 and 6 after the shared change**

**Scene 1 — Does the round-5 PASS stand? Yes.**

The small card still reads immediately as the spending destination, and its canonical glyph remains recognizable. The finer tear does not weaken its silhouette or the chest-to-destination relationship. The closed landing ellipses and decorative-cord/path ambiguity remain the previous refinements; the shared change introduces no blocking defect.

**Scene 5 — Does the round-5 PASS stand? Yes.**

The card remains dominant, its double-frame seal is clear, and the thinner tear improves the gold-to-lacquer transition. The book and tweezers remain identifiable supporting objects. Regular overlap rows, the central chip cluster and the book’s weak leaf-to-paper separation still limit material conviction.

**The secondary lacquer reflection remains here.** Its removal applies only to the flat card: the dimensional prop still carries two bands. They are visibly graphic and deserve further softening, but do not reverse the scene’s existing PASS.

**Scene 6 — Does the round-5 PASS stand? Yes.**

The foreground note’s canonical seal remains readable, while the smaller white stamp on the bundle band retains glyph recognition despite losing hairline detail. Both labels remain legible, unclipped and clearly associated with their objects. The SVG confirms the Mainnet plate is in the tray’s `back` layer and the Practice plate in the bundle’s `main` layer; this establishes layer membership, not accepted motion.

The blue tray still attracts a disproportionately strong first glance, and the bundle still compresses into a fairly solid block at phone scale. Those round-5 limitations remain.

**4. Anything that got worse**

- **Practice-label edge clearance is tighter.** Its right inset decreased from **10 pt to 6 pt** because the plate moved right and narrowed. The current static render remains unclipped, but it has visibly less breathing room against the hero’s right edge.
- **Small stamped seals have less border presence.** The canonical inset frame and thinner stroke make Scene 1’s card stamp and Scene 6’s band stamp quieter than the former enclosing frame. Recognition survives, so this is an optical tradeoff rather than a reason to reverse PASS.
- **The new overlay mock looks more crowded than the previous simplified presentation.** It exposes an existing app-layout weakness; it is not deterioration in the card artwork.

I see no new blocking visual regression in the requested masters.

### Card face and seal — round 6 verdict (verbatim)

**1. Overall verdict**

The recolouring removes the lemon-yellow presentation and brings the assets into the specified gold/lacquer palette, but I would not approve the complete set yet. The front fails because its seal changes the canonical geometry and its outlined tear reads thicker than gold leaf. The back, standalone seal and variants are adequate first-pass masters for the user’s design review; that does not establish production readiness or card issuance.

**2. Per piece**

**Kinpaku card front — FAIL**

The masked number and mock holder are legible on both grounds. The leaf stops sufficiently far left of the overlay, “Kinpaku” remains subordinate to the number, and the bottom-right network position is clear.

Changes, in priority order:

1. **Restore the canonical seal geometry.** The front has one rounded frame; the standalone seal and back retain the double frame. Its glyph-to-frame proportions also differ. This is visibly a second mark, contrary to direction §10’s geometry-preservation requirement. Use the canonical carving paths against the existing leaf field. The separate construction is confirmed in [props.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/props.py:112).
2. **Make the tear look thin.** The continuous brown outline, broad angular bites and conspicuous triangular notch near the middle make the gold look like cut sheet material. Reduce the outline substantially, interrupt its shading, and introduce finer irregularities between the larger tears. Keep the fragments closer to that edge.
3. **Refine the reflection.** The broad, straight diagonal bands cross the lacquer like printed stripes. Soften their boundaries and reduce the secondary band’s strength. The square overlaps are appropriate to laid leaf, but the scattered straight scratches look drawn independently of its folds; concentrate them around overlaps and small wrinkles.
4. **Review the complete app overlay.** The sheet substitutes “A. Holder” and omits expiry. The actual [CardFace.tsx](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/apps/mobile/src/features/card/CardFace.tsx:33) places holder and expiry side by side and uses uppercase labels. At 343 px, that row has only about 141 px available before dividing those fields. Show the real overlay, including the sample holder and a longer name, before accepting its hierarchy and truncation.

There is no invented network logo or issuance claim in the artwork itself. The numbered presentation needs an adjacent **Design preview** or applicable **Sandbox · No charge** label when shown outside the app’s existing preview context, consistent with R16.

**Kinpaku card back — PASS**

The narrow gold band, quiet lower-left naming and lower-right canonical seal form a coherent reverse. The lacquer silhouette remains distinguishable on dark ground and clearly bounded on light ground. Its empty centre is acceptable for this decorative master.

Changes, in priority order:

1. Soften the diagonal lacquer reflection to match the corrected front.
2. Vary the band’s tearing more finely. Its long straight stretches and angular notches currently suggest a torn ribbon; subtler overlap changes would better suggest applied leaf.
3. Treat the small lower-left lettering as branding, not required information. At phone width, “Kinpaku” is approximately 10 px high and 金箔 approximately 9 px; any functional text needs a separate readable treatment.

The band occupies the familiar magnetic-stripe position, but its appearance alone does not claim working hardware. There is no reason to add issuer, network or security furniture without provider evidence.

**Seal — primary, including small sizes — PASS**

At 96 and 48 px, the double frame and 千 are distinct. At 32 and 24 px, 千 remains recognizable on both grounds; the internal dark carving carries recognition even where the light ground weakens the pale upper-left perimeter.

Changes, in priority order:

1. Create an optical small-size treatment. The inner border is only **0.25 px at 32 px and 0.19 px at 24 px**. It becomes uneven and crowds the heavier frame; the carved-edge highlight also largely disappears. Simplify those decorative details while preserving the master glyph and overall proportions.
2. At large sizes, introduce a restrained irregularity in the reflected light. The smooth diagonal gradient and continuous bevel currently read more like a brass plaque than leaf. This is acceptable abstraction for a first-pass identity mark, but its material specificity could improve.

The small-size problem is border fidelity, not loss of glyph recognition.

**Seal variants and app icon — PASS for the shown uses**

The inverse is readable on both grounds. The mono is clear on dark ground, and the simplified favicon gives 千 substantially more space. The app icon’s opaque violet-black field and centred gold seal are coherent with the primary.

Changes, in priority order:

1. Apply the same small-size border simplification to inverse and mono variants.
2. Check the app icon under its actual platform mask and at home-screen size. The seal occupies 58% of the canvas, leaving generous margins and reducing its impact; compare a modest enlargement before selecting the final scale.
3. Supply an ink mono variant if a monochrome light-ground use is required. The current pale mono asset is unsuitable there; the sheet substitutes the favicon and therefore does not demonstrate that case.
4. Address the remaining typography inconsistency in the associated outputs: [build.py](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/build.py:62) still generates the uppercase JetBrains Mono wordmark for lockups, splash and logos. That retains D2 typography against §5.3’s replacement direction.

**3. Anything that got worse than the old versions**

- **Front identity consistency:** the old card carried the recognizable double-frame seal; the redraw replaces it with a single-frame interpretation.
- **Leaf-edge plausibility:** the old finer, fragmented boundary suggested fragile leaf more convincingly. The new continuous outline makes the edge look thick.
- **Lacquer plausibility:** the old soft reflection suggested a continuous surface; the new diagonal bands look more like graphic decoration.
- **Immediate visual punch:** the muted seal attracts less attention than the old yellow square. That is an intentional palette tradeoff, but the app icon’s generous margins compound it.

The old heavy grain and lemon colour should not return; recover the finer edge and softer reflection within the new ramp.

## Seal and card front — round 8 verdict (verbatim)

Shown: `brand/review/seal-sizes.png`, `seal-sizes-lemon-before.png`, `seal-variants.png`, `kinpaku-card-400.png` and the
scene-2 phone mock. The fix that followed is described under "After round 5" above and was not re-reviewed.

**(a) Small seal, 24–88 px — PASS, narrowly.** At 24 px, 千 retains its upper sweep, crossbar and stem on both backgrounds. The hairline frame softens, but the glyph stays distinct. At 32–88 px, the lighter upper-left face and darker lower-right corner provide enough variation to read as a small gold object. The 3x versions improve edge definition. It clears the “flat mustard square” threshold, although the gold is subdued.

**(b) Large seal — FAIL.** At 264 px, the broad ochre-brown face, heavy lacquer frame and continuous pale line beneath the carving read as a brass plaque. The cream outline beneath the stem and lower frame makes the bevel-and-emboss construction conspicuous. The onboarding tile has a clearer pale reflection and less visually dominant edge treatment.

Fix, in priority order:

1. **Improve the face reflection.** In [LEAF_DEFS](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/build.py:42), the base gradient actually has **four stops**, starting at `#EACF8C`; `#FFF0BC` appears only through the translucent bloom and bevel. Put the cream highlight into the base ramp, carry the lighter gold farther across the upper-left face, and confine the deepest brown toward the far corner. The [reference tile’s face ramp](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/scripts/kit.py:314) is a useful starting point.
2. **Reduce the carving’s caught-light outline.** Start by lowering `CATCH_OPACITY` from `0.5` toward `0.2` and roughly halving the displacement. Fade its strength toward the far corner. Preserve the geometry; the problem is the lighting hierarchy.

**(c) Inverse and mono — FAIL overall: inverse FAIL; mono PASS.** The inverse’s lacquer field is appropriately quiet, but at 264 px its upper 千 is pale cream while nearby frame sections are already deeper gold. The pieces appear separately illuminated.

There is a concrete source cause: the [inverse glyph](/Users/abu/dev/hackathon/metropolis/.claude/worktrees/art-j1/brand/senryo-seal-inverse.svg:8) has a translation and scale, which also transform its `userSpaceOnUse` gradient. The frames use that gradient in untransformed seal coordinates.

**Priority fix:** transform the glyph coordinates into the seal’s 512-unit space before applying the shared gradient, or compensate its gradient transform. Gold at the same position should receive the same light across glyph and frames.

The mono specimen passes: one consistent colour, clear 千 and clean frame hierarchy. Its simplicity suits a monochrome mark.

**(d) Kinpaku card front, 400 px — PASS.** This is the strongest material treatment. The broad pale reflection across the left field, faint overlapping sheets and finely torn boundary read as thin leaf on lacquer. The roughly 50 px seal remains legible and feels pressed into the surface. The lacquer reflection is restrained, and the right half gives the number room. “Senryo” is small but readable; `金箔` works as subordinate detail. The sheet seams are near the upper limit of visibility—stronger seams would start resembling tiles.

Compared with the inspected Solflare and Phantom recording frames, the card meets the authored-material bar more convincingly than the large seal.

**Single most valuable change: give the primary seal a broader cream reflection across its face, bringing its lighting closer to the onboarding tile.**

