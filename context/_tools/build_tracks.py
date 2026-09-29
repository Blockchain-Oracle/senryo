"""Regenerate context/01-tracks/*.md from the portal capture (context/_portal/api/catalog.json).

Official text is copied verbatim from the catalog; our own analysis lives in
context/01-tracks/_analysis/<slug>.md and is appended under a clearly separate heading.
Re-run after re-capturing the portal:  python3 context/_tools/build_tracks.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "_portal/api/catalog.json").read_text())
file_map = json.loads((ROOT / "_portal/api/bounty-file-map.json").read_text())
tracks = sorted(catalog["tracks"], key=lambda t: t["sortOrder"])
track_names = {t["id"]: t["name"] for t in tracks}


def sponsor(b):
    s = b.get("sponsor") or b.get("partner")
    return s.get("name") if isinstance(s, dict) else s


def bounty_rows(bounties):
    rows = ["| Sponsor | Bounty | Prize | Split | What it asks for (verbatim summary) | Full text |", "|---|---|---|---|---|---|"]
    for b in sorted(bounties, key=lambda b: b["sortOrder"]):
        split = (b.get("prizeBreakdown") or "").replace("\n", " ").replace("|", "/")
        link = f"[open](../_portal/bounties/{file_map[b['slug']]})"
        rows.append(f"| {sponsor(b)} | {b['name']} | {b['prize']} | {split} | {b['summary']} | {link} |")
    return "\n".join(rows)


all_track = [b for b in catalog["bounties"] if not b["trackId"]]

for i, t in enumerate(tracks, 1):
    own = [b for b in catalog["bounties"] if b["trackId"] == t["id"]]
    ideas = "\n".join(f"{n:02d}. {x.lstrip('• ').strip()}" for n, x in enumerate(t["ideas"], 1))
    out = [
        f"# Track {i:02d}: {t['name']}",
        "",
        f"> **Source of truth:** the logged-in portal (`_portal/api/catalog.json`, captured 2026-09-29). "
        f"Everything above **Our analysis** is copied verbatim. Page capture: [../_portal/tracks/{t['slug']}.md](../_portal/tracks/{t['slug']}.md)",
        "",
        f"**Prize:** {t['prize']} ({t['prizeBreakdown']})",
        "",
        f"**Summary:** {t['summary']}",
        "",
        "## What this track is for (official)",
        t["description"],
        "",
        "## Judging criteria (official, from this track's page)",
        *[f"- {c}" for c in t["criteria"]],
        "",
        "> ⚠️ The **official rules** (`_portal/pages/rules.md` §5.2) give a *different* main-track rubric: Product Quality & Completeness, "
        "Technical Excellence, Monad Integration, Track Fit & Problem Relevance, Innovation & Impact (20% each). Plan for both; ask organizers which one applies.",
        "",
        "## Deliverables (official)",
        *[f"- {d}" for d in t["deliverables"]],
        "",
        f"## Suggested ideas (official, all {len(t['ideas'])})",
        ideas,
        "",
        "## Bounties tied to this track (official)",
        "The Tracks & Bounties page says: *\"Each one names its track, and the ones marked All tracks pair with any.\"* "
        "These are only open to projects entered in this track:",
        "",
        bounty_rows(own) if own else "_None. Only the All-tracks bounties below apply._",
        "",
        f"Plus the **{len(all_track)} All-tracks bounties**, which pair with any track. See [../00-hackathon/prizes-and-bounties.md](../00-hackathon/prizes-and-bounties.md).",
        "",
        "---",
        "",
    ]
    analysis = ROOT / "01-tracks/_analysis" / f"{t['slug']}.md"
    out.append(analysis.read_text() if analysis.exists() else "## Our analysis\n_Not written yet._\n")
    (ROOT / "01-tracks" / f"{t['slug']}.md").write_text("\n".join(out))
    print("wrote", t["slug"], "ideas:", len(t["ideas"]), "own bounties:", len(own))
