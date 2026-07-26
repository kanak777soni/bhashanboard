# Ovation *(working title)*

> **A permanent, sourced, ranked archive of the things politicians actually said — presented with the total institutional seriousness of an international awards committee.**

India first. Then the world.

**Status:** planning. No code yet — see `docs/` and the decisions in `docs/06-roadmap.md` §6.5.

---

## The plan in one page

| | |
|---|---|
| **What it is** | A league table for public political statements. Unedited clips, community-ranked, awarded medals. |
| **The joke** | Not the clips — the *frame*. Gold foil, wax seals, roman numerals, orchestral fanfare, a straight-faced committee awarding **Kohinoor Class** to a real quote about clouds blocking radar. |
| **The mechanic** | Pairwise duels (*Aamne-Saamne*) → Elo ratings → tiers → leaderboards. Chess ranking, applied to speeches. |
| **The moat** | A structured, sourced, transcribed, translated corpus of Indian political statements. It doesn't exist today. |
| **The constraint** | **Verbatim only.** Never edit, dub, impersonate, or AI-generate. Ever. |

## Three principles everything else hangs off

### 1. The Verbatim Doctrine
**We never edit the claim. We only decorate it.** Every clip is unedited, in-context, source-linked, timestamped. All sarcasm lives in the chrome — medals, tiers, trophy cabinets, ceremony. Never in the footage.

This isn't just taste. In March 2026 the Indian government blocked dozens of parody accounts under §69A and had Instagram remove a Modi-impersonation reel under §79(3)(b). **Impersonation got hit; verbatim archives did not.** Truth is also the defence under BNS §356 — quoting someone verbatim makes the imputation true by construction. → `docs/04-legal-and-safety.md`

### 2. Deadpan Prestige
The site should look like the Nobel Committee's website, not a meme page. Serif type, gold foil, zero exclamation marks. **The gap between the gravity of the presentation and the content of the clip is the entire comedic engine.** → `docs/01-concept.md`

### 3. Neutrality is engineering, not sentiment
A **Party Parity Meter** on the homepage, queue balancing enforced in code (no party > 40% of the last 100 clips), cross-party duel pairing, and a public monthly audit. Without this the site is branded partisan within 48 hours and is dead. → `docs/01-concept.md` §1.5

## The ranking system

```
NEW STATEMENT → 🟡 PROVISIONAL (1500 GP) → 20 placement duels → ✅ RANKED #47 · 🥇 GOLD
```

| Tier | Name | Rarity |
|---|---|---|
| 🪵 | Participation Certificate | ~28% |
| 🥉 | Bronze Bhashan | ~24% |
| 🥈 | Silver Tongue | ~21% |
| 🥇 | Gold Standard | ~16% |
| 💎 | Diamond Gyan | ~8% |
| 👑 | **Kohinoor Class** | ~2.5% |
| 🏛 | Hall of Fame | ~50 all-time |

*Kohinoor Class: so valuable it had to be kept abroad.*

**Why duels instead of stars:** star ratings bunch at 4.7, are trivially brigadable by party IT cells, and are boring. Duels produce a clean total order, can't be targeted (you don't choose your matchups), and are genuinely addictive — the duel feed is your retention engine, your discovery feed, and your labelling pipeline in one screen. → `docs/02-ranking-system.md`

## Docs

| File | Contents |
|---|---|
| [`docs/01-concept.md`](docs/01-concept.md) | Positioning, the Verbatim Doctrine, Deadpan Prestige, content policy, naming (and the loaded-word trap) |
| [`docs/02-ranking-system.md`](docs/02-ranking-system.md) | Elo + duels, placement matches, tiers, judgment axes, anti-brigading, politician player-cards, leaderboards |
| [`docs/03-content-pipeline.md`](docs/03-content-pipeline.md) | Embed-never-host, source tiers, the 4-stage pipeline, cold start, multilingual subtitles |
| [`docs/04-legal-and-safety.md`](docs/04-legal-and-safety.md) | **Can we use real names/images?** (yes), BNS §356, publisher-vs-intermediary trap, IT Rules 2026, MCC mode, risk register |
| [`docs/05-growth-and-money.md`](docs/05-growth-and-money.md) | Share-card growth loop, The Weekly Gyan, The Standing Ovations, monetisation, global sequencing |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Phases, architecture sketch, metrics, what could kill this, **decisions needed from you** |

## Answering your specific questions

**"Can we use their real names and images, or do we need alternatives?"**
**Real names and images — yes.** The Delhi HC has held that using a public figure's name or image for commentary, satire, parody or news reporting is protected under Art. 19(1)(a) and does not infringe publicity rights. Pseudonyms would make the product *worse* — a caricature is a statement you authored; a verbatim clip is a fact you cited. Two hard limits: **no faces on merchandise** (that's the commercial-exploitation pattern that actually loses in court — sell the *quote* in typography instead), and **no AI-generated likeness, ever.**

**"How do we place a new speech in the right spot?"**
**Placement matches** — it enters provisional at 1500 GP, gets priority-injected into the duel feed for ~20 duels over 6–24 hours, then slots in with a rank and a tier. The provisional window is itself live content: *"⏱ 3 statements are currently being ranked."*

**"Stars, diamond, gold — all those things?"**
Yes, and made rigorous — fixed rating bands with calibrated rarity, so Kohinoor Class actually stays rare and therefore actually means something. Plus trophy cabinets, form guides, career-arc graphs, auto-conferred honorifics (*"Professor of Applied Physics"*), and a full promotion ceremony with confetti and orchestral sting.

## Before writing code

Six decisions are in `docs/06-roadmap.md` §6.5 — name, duels vs stars, verbatim-only, community timing, anonymity, and legal budget. Answer those and the build order in §6.1 is ready to go.

---

*This project mocks arguments, not accents. Public statements by public figures in public roles — nothing else.*
