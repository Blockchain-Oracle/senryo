# Task: Capture the complete Metropolis hackathon portal (read-only)

You have access to my **Zen browser**, where I am already logged in to https://hackathon.monad.xyz (Monad's "Metropolis" hackathon). Capture **every piece of information** on the portal, word for word, into local files so nothing is missed. This is a **read-only** job.

## Hard rules
- **Do not click anything that changes state.** No submit, save, apply, join, select a track, add a bounty, edit profile/project/team, send a message, RSVP, or connect a wallet. If a control might change something, skip it and note it in the report.
- **Do not log in, log out, or enter any credentials.** Use the existing session only. If the session has expired, stop and tell me.
- **Never write cookies, tokens, session IDs, or auth headers into any file.**
- **Copy text exactly (verbatim).** Do not summarise, paraphrase or "clean up" wording in the raw captures. If something fails to load, record it as FAILED with the URL. Never guess or fill gaps.
- Expand everything: click every tab, accordion, "show more", "read more", modal and filter view, so hidden text is captured. Scroll to the bottom of each page so lazy-loaded content appears.

## Output location
Save everything under: `/Users/abu/dev/hackathon/metropolis/context/_portal/`
```
_portal/
├── api/                  # raw JSON from the portal's own API
├── pages/                # one .md per page, verbatim visible text
├── tracks/               # one .md per track detail page
├── bounties/             # one .md per bounty detail page (every single one)
├── screenshots/          # full-page screenshot of every page captured
└── INDEX.md              # inventory + completeness report (see below)
```

## Step 1: Raw API data (most important)
The portal loads its data from `https://hackathon.monad.xyz/api/v1/...`, which needs the logged-in session. **In the logged-in browser tab**, open each URL below and save the full JSON response verbatim to `_portal/api/<name>.json`:
- `https://hackathon.monad.xyz/api/v1/catalog` → `catalog.json` (all tracks, bounties, requirements, resources and livestreams)
- `https://hackathon.monad.xyz/api/v1/bootstrap` → `bootstrap.json`

Open the browser devtools **Network** tab, then visit every page in Step 2. Save the response of **every other `/api/v1/...` request** you see (e.g. directory, mentors, calendar, FAQ, rules) as `_portal/api/<endpoint-name>.json`. Before saving, **delete any personal data** about me or other users (emails, contact info) and any tokens.

## Step 2: Every page, verbatim
Visit each page. Save its visible text as Markdown in `_portal/pages/<page>.md` (keep headings, lists, tables and links; put the source URL at the top) plus a full-page screenshot in `_portal/screenshots/`:
- Dashboard, Project (read-only view), **Tracks & Bounties**, Prizes, Matchmaking, Mentors, **Calendar** (every event: title, date/time UTC, speaker, description, link), Support (including the **FAQ** / "Reading the FAQ" content), **Resources** (every sponsor perk, livestream, doc link and how to claim each perk)
- **Official rules / terms / eligibility**: find wherever they are linked (footer, FAQ, application flow, modal) and capture them in full
- **Submission requirements**: every field and question the submission form asks for, including the extra fields each bounty requires. Read the form, do not submit it.
- Any other page reachable from the navigation or footer

## Step 3: Every track and every bounty
- On Tracks & Bounties, open **each of the 4 primary tracks** (`/tracks/onchain-finance`, `/tracks/consumer-payments`, `/tracks/social-culture`, `/tracks/trust-identity-ai`). Save the full detail page (description, example ideas, judging criteria, requirements, resources, prizes) to `_portal/tracks/<slug>.md`.
- Open **every sponsor bounty** listed (all of them, including "All tracks" ones). Save each to `_portal/bounties/<sponsor>-<short-title>.md` with: sponsor, title, prize amount and split, eligible track(s), full description, requirements/submission fields, judging criteria, resources/docs links, and contact person.
- In particular, find any bounty or track idea about a **token launchpad where launched tokens can be swapped/traded immediately**, and note exactly which one it is in INDEX.md.

## Step 4: INDEX.md (completeness report)
Write `_portal/INDEX.md` with:
1. Capture date/time and whether the session stayed logged in the whole time.
2. A table of **every page, track and bounty** captured: name | URL | file | status (OK / FAILED / PARTIAL).
3. Counts: tracks = ?, bounties = ?, total bounty $, calendar events = ?, resources/perks = ?. Cross-check these counts against `catalog.json`; they must match. If they don't, find what's missing.
4. The launchpad finding from Step 3.
5. Anything you could not capture, and why.

## Step 5: Reconcile with my existing notes
I already have a knowledge base at `/Users/abu/dev/hackathon/metropolis/context/`, built from public sources only. Compare it with what you captured and write `_portal/DIFF.md` listing:
- **Missing**: tracks, ideas, bounties, perks, rules or dates in the portal that my notes lack (especially `context/00-hackathon/prizes-and-bounties.md` and `context/01-tracks/*.md`)
- **Wrong**: any fact in my notes that the portal contradicts (amounts, dates, judges, requirements). Quote both versions with file and line.
- **Unconfirmed**: statements in my notes marked "(unverified)" that the portal now confirms or refutes

Do **not** edit my existing context files; only write inside `_portal/`. When finished, reply with the counts from INDEX.md and the top 10 most important items from DIFF.md.
