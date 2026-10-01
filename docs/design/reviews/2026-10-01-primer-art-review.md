# Primer art (S1b.13): Codex design review

**Reviewed 1 October 2026 by Codex (`gpt-5.5`, reasoning `xhigh`, read-only sandbox), three rounds. Final verdict
(round 3): `primer-notifications` SHIP, `primer-face-id` SHIP, "No blocking fixes. These are ready." As with the J1
review, this is a pass for static masters only; it says nothing about motion, native rendering or the primer screens.**

The two first-run permission-primer heroes, written by `brand/scripts/primer_bell.py` and `brand/scripts/primer_lock.py`
(driven by `brand/scripts/onboarding.py`) into `brand/art/onboarding/`, registered in
`packages/identity/src/art/onboarding.ts` and generated as `NATIVE_ART["primer-notifications"].symbol` and
`NATIVE_ART["primer-face-id"].symbol` (viewBox `0 0 640 640`, transparent ground):

- `primer-notifications`: a gold fūrin seen from a little below, laid in kinpaku, with a lacquer waist band, a holed
  gold coin for its clapper, arcs of light for the ring, and an uchigumori tanzaku in a breeze. Replaces the
  reference's flat white bell (Solflare S14).
- `primer-face-id`: an ebi-jō (Edo shrimp lock) opened: a lacquer barrel with kiku-edged gold caps, a finial, a keyhole
  and the inlaid seal; a gold shackle bent like a shrimp's back, lifted off its socket with its steel spring leaves
  showing; four corners of gold light with an app-blue line inside, framing a look without the Apple Face ID glyph.
  Replaces the reference's sculpted purple open padlock (Phantom P10).

## How it was run

- Each round: `codex exec -m gpt-5.5 -c model_reasoning_effort=xhigh -s read-only -i <five sheets> - < <brief>`.
- The brief described the Living Lacquer system (materials, light from the upper left, SVG-only rules), both pieces,
  the references they replace, the 132–160 pt display size and both theme grounds. From round 2 on, it also carried
  the reviewer's previous verdict and a list of what had changed.
- Sheets: (1) the existing family (pending-passkey key, completion foil) beside both new pieces on the dark `#0A0911`
  and light `#F5F4F8` grounds; (2) each piece at 640 px on both grounds; (3) both at 132 pt rendered at 3x; (4) both at
  132 px, 1x, as a squint test. Rendered with `rsvg-convert`. The SVGO-optimised SVG that codegen writes renders
  pixel-identical to each master (ImageMagick AE, 2 % fuzz: 0 px differ).

## Rounds

| Round | Notifications | Face ID | What changed before the next round |
|---|---|---|---|
| 1 | ship after fixes | ship after fixes | Fūrin: up 6 %; ring arcs (own layer); tanzaku made matte, with washi deckle edges, mottling, a folded head and a larger eyelet; bell laid in kinpaku (broken seams, faint creases). Lock: corners pulled in with an app-blue inner line; stray star removed; bigger spring leaves and a legible socket; kiku-edged caps; deeper barrel; down 4 %. Both: shadows softened and warmed toward lacquer. |
| 2 | **ship** | ship after fixes | Lock: right-angled corners held at strength, a longer and brighter blue line, no stars on the frame; leaves thicker and upright (lift 32, swing −4°); rounder socket; barrel enlarged, arch lowered, bigger seal, near cap given thickness; shackle highlights broken like beaten leaf. Tanzaku: lower blues and the violet foot dulled; long kozo fibres; far edge torn rougher. |
| 3 | **ship** | **ship** | Final. Polish after it, below. |

## Final verdict (round 3), verbatim

**Round-2 Status**
- `primer-notifications`: **Ship.** The remaining tanzaku issue is **resolved enough**. It still becomes a simple blue strip at 132 px, but it no longer feels like clean ribbon; the torn edge, fibers, dust, and duller violet make it read as authored paper in the actual app size.
- `primer-face-id`: **Ship.**  
  1. Frame signal: **resolved.** It now reads as sensing/framing, not decoration, and it avoids Apple’s Face ID glyph.  
  2. Spring leaves: **mostly resolved.** They survive at 132 px, though they still flirt with “down arrow.”  
  3. Barrel as hero: **resolved.** The body has enough authority now; the piece no longer collapses into a generic U-padlock.  
  4. Shackle gold: **resolved.** The broken highlights bring it back into the Living Lacquer family.

**Final Verdicts**
- `primer-notifications`: **Ship.** Instant notification read, strong fūrin specificity, excellent fit with the key/foil family, and good dark/light performance.
- `primer-face-id`: **Ship.** It reads as “secure unlock by looking” at phone size. The biometric cue is secondary to “lock,” but the frame now carries enough scan language for a permission primer with title copy.

**Last Issues**
1. `primer-face-id`: spring leaves still read a touch arrow-like.  
Fix: flatten the leaf tips slightly, give the two steel leaves subtly unequal angles, and reduce any central visual stem so it feels like sprung metal, not a downward indicator.

2. `primer-notifications`: the tanzaku loses paper fiber at the smallest size.  
Fix: make one or two kozo fibers higher contrast and larger, preferably near the lit upper third, not at the busy gold-dust foot.

3. Both: the gold is now beautiful, but the bell feels more culturally specific than the lock.  
Fix: for future animation/state variants, let the lock body/caps lead the motion before the shackle, preserving the ebi-jō object read.

No blocking fixes. These are ready.

## What changed after the final verdict

Two of the round-3 "last issues" were small and concrete, so they were applied after the verdict. They were checked
on renders at 640 px and at 160 pt on both grounds, but **not re-reviewed by Codex**:

- Last issue 1 (the leaves read slightly arrow-like): each spring leaf is now a strip of steel, narrow where it is
  riveted and cut square at its free end. The two leaves differ (spread 21/16, length 29/25), and the bolt below the
  bar is shorter (54 → 46), so less of a central stem shows.
- Last issue 2 (the paper fibre is lost at the smallest size): two kozo fibres in the lit upper third are larger
  (1.8 px) and stronger (a paler blue at 0.32).
- Last issue 3 is for later motion work and changes no art: let the lock's body and caps lead the motion before the
  shackle lifts. It is recorded here for whoever animates the layers.

Layers for motion, back to front (`brand/art/onboarding/layers.json`, which now also records `pivots` in master units):

- `primer-notifications`: `bell-shadow`, `tanzaku-shadow`, `clapper-shadow`, `bell` (swings about the cord loop),
  `ring`, `tanzaku` (moves most; sways about the coin's hole), `clapper` (swings from where its string leaves the
  bell), `glints`.
- `primer-face-id`: `shadow`, `shackle` (moves most; lifts and swings about its fixed leg's boss), `body`, `glints`
  (the corners of light).

## Earlier rounds, verbatim

### Round 1

**Verdicts**
- `primer-notifications`: **Ship after fixes.** The bell reads instantly at 132 pt and belongs to the family, but the paper strip is too ribbon-like and the notification metaphor could be sharpened.
- `primer-face-id`: **Ship after fixes.** Beautiful object, strong family fit, but the Face ID cue is currently secondary to “decorative open lock.”

**Ranked Issues**
1. `primer-face-id`: Face ID signal is too ornamental. The four gold corner marks read like decorative sparkles/brackets, especially on dark.  
Fix: move the corners closer to the lock, make all four clearly frame a focus area, reduce extra star glints, and add a very subtle blue-violet inner accent so it feels like an active scan frame without copying Apple’s glyph.

2. `primer-notifications`: the tanzaku reads more like glossy blue ribbon/plastic than uchigumori paper.  
Fix: flatten the sheen, soften/rag the side edges, add fibrous cloudy mottling, and make the punched hole/reinforced head more visible at 132 pt.

3. `primer-face-id`: the steel spring leaves are too small and ambiguous. At small size they look like a hook, fang, or broken wire.  
Fix: enlarge the two silver leaves, separate them more clearly, and show the lifted shackle end coming out of a visible socket.

4. `primer-notifications`: notification meaning is carried almost entirely by “bell,” not by “alert.”  
Fix: add one restrained ring/glint arc near the bell mouth or top-right side, layer-separated for animation. Keep it authored gold/violet, not a generic notification badge.

5. `primer-face-id`: cultural specificity is close but slightly modern-padlock dominant.  
Fix: make the barrel tube feel more like the hero: deepen the lacquer cylinder curvature, enlarge the far finial/socket logic, and make the gold caps less like generic padlock hardware.

6. Both: light-ground shadows are a touch heavy/sticker-like compared with the existing family.  
Fix: soften and warm the cast shadows, keep them falling lower-right, and reduce the dense gray edge behind the bell and lock.

7. Both: visual weight mismatch. The lock feels larger and more assertive than the bell in the 132 pt comparison.  
Fix: scale the bell up about 5-8% or scale the lock down slightly; keep the bell’s mouth ellipse readable.

8. Both: gold is strong, but slightly too uniformly polished in places.  
Fix: introduce a few more beaten-leaf interruptions on broad gold areas, especially the bell dome and lock shackle, while preserving the upper-left highlight discipline.

Overall: these are well above generic app art. The bell is closest. The lock needs the scan-frame and spring-leaf fixes before I’d trust it as a Face ID primer at phone size.

### Round 2

**Verdicts**
- `primer-notifications`: **Ship.** Round-2 clears the functional bar: it reads as a notification bell at 132 pt, feels authored, and now belongs with the key and foil.
- `primer-face-id`: **Ship after fixes.** Much stronger, but at 132 pt it still reads first as “decorative open lock,” with “look/scan” arriving second.

**Round-1 Issue Status**
1. Face ID frame signal: **partly resolved.** Pulled-in corners help; the blue-violet accent is right. Still too ornamental at phone size.
2. Tanzaku paper read: **mostly resolved.** The matte deckle and eyelet work. The strip still reads slightly like dyed ribbon at 1x because the blue is so saturated and clean.
3. Spring leaves: **partly resolved.** Clearer at full size, but still collapses into a little V-hook at 132 px.
4. Notification alert cue: **resolved.** The ring arcs make the bell read as active without becoming generic.
5. Ebi-jō specificity: **mostly resolved.** Kiku caps and deeper cylinder help; the oversized U shackle still pushes it toward modern padlock.
6. Light-ground shadows: **resolved.** Softer, warmer, and more family-consistent.
7. Visual weight mismatch: **resolved.** Bell and lock now balance well in the 132 pt comparison.
8. Uniform polished gold: **mostly resolved.** Bell gold is better; lock shackle remains a little too clean.

**Remaining Issues**
1. `primer-face-id`: the scan frame is still not doing enough semantic work.  
Fix: make the four corners more optically rectangular and closer to the active lock area, with the inner blue-violet line longer and slightly brighter. Remove or reduce the star glints sitting on the corners; they make the frame read as ornament, not sensing.

2. `primer-face-id`: spring leaves still become ambiguous at app size.  
Fix: thicken the two steel leaves, separate their tips farther, and make the dark socket hole larger and more circular so the viewer understands “unlocked mechanism,” not a dangling hook.

3. `primer-face-id`: shackle dominates the cultural read.  
Fix: slightly lower or shorten the lifted shackle arc, and give the barrel/body more visual authority: a wider lacquer face, stronger end-cap thickness, and clearer inlaid seal. Let the ebi-jō tube be the hero, not the U shape.

4. `primer-notifications`: tanzaku is good enough to ship, but could be more paper-like.  
Fix: dull the lower blue-violet saturation by 5-10%, add a few larger cloudy fibers, and make one edge visibly irregular at 132 pt.

5. Both: gold highlights are attractive, but the lock shackle is the smoothest outlier.  
Fix: add two or three subtle beaten-leaf interruptions on the shackle’s upper-left highlight, following the same restraint now visible on the bell dome.

Net: bell is there. Lock is close, but I would not ship the Face ID primer until the frame and mechanism survive the 132 px squint test without relying on the title.
