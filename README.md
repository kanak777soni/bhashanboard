# The Bhashan Board *(working title)*

> **A permanent, sourced, ranked archive of the things politicians actually said — presented with the total institutional seriousness of an international awards committee.**

India first. Then the world.

**Status:** pre-launch application with a 44-entry source corpus, registered accounts, verified-email authentication, server-timed video-gated one-time public rulings, an auditable Bayesian rating model, and administrator user controls. Every current corpus entry is still text-sourced, so public voting remains correctly locked until verified excerpts are attached.

---

## Database setup

The live application uses Neon Postgres as its source of truth. Copy
`.env.example` to `.env`, set the pooled Neon `DATABASE_URL`, authentication
secret/site URL, Cron secret, and Brevo transactional-mail credentials. For
production, use a restricted runtime role in `DATABASE_URL` and keep the
owner-capable connection only in local `MIGRATION_DATABASE_URL`. Then run:

```bash
npm run db:setup
```

That command applies checksum-protected migrations, validates and imports the
current JSON corpus without deleting remote rows, and verifies document hashes,
foreign-key-backed records, exact source artifacts, the statement ID sequence,
and the append-only audit ledger. It is safe to run again: unchanged rows are
not rewritten. A row edited through the admin is protected from later seed
imports and must be reconciled manually if its local JSON counterpart changes.

For production, copy every required value documented in `.env.example` into the
hosting environment. Sign up and verify the first account, then promote it once
from a trusted terminal with
`npm run admin:promote -- verified-user@example.com`. Registered administrators
can promote other verified users in `/admin/users`. There is no shared browser
password or network-facing bootstrap endpoint. Never expose `DATABASE_URL`,
`BETTER_AUTH_SECRET`, or `BREVO_API_KEY` through a `NEXT_PUBLIC_` variable.
Newsletter consent is stored only in Neon; this application does not mirror
subscription state into a Brevo contact list. Vercel invokes the bearer-protected
retention route daily to remove expired sessions, verification records,
rate-limit buckets, and stale unfinished watch sessions.

---

## The plan in one page

| | |
|---|---|
| **What it is** | A league table for public political statements. Unedited clips, community-ranked, awarded medals. |
| **The joke** | Not the clips — the *frame*. Gold foil, wax seals, roman numerals, orchestral fanfare, a straight-faced committee awarding **Kohinoor Class** to a real quote about clouds blocking radar. |
| **The mechanic** | Watch a verified excerpt → enter one of five fixed rulings once → transparent Bayesian performance → GP, tiers, and standings. *Aamne-Saamne* remains a non-scoring exhibition. |
| **The moat** | A structured, sourced, transcribed, translated corpus of Indian political statements. It doesn't exist today. |
| **The constraint** | **Verbatim only.** Never edit, dub, impersonate, or AI-generate. Ever. |

## Three principles everything else hangs off

### 1. The Verbatim Doctrine
**We never edit the claim. We only decorate it.** Every clip is unedited, in-context, source-linked, timestamped. All sarcasm lives in the chrome — medals, tiers, trophy cabinets, ceremony. Never in the footage.

This isn't just taste. In March 2026 the Indian government blocked dozens of parody accounts under §69A and had Instagram remove a Modi-impersonation reel under §79(3)(b). **Impersonation got hit; verbatim archives did not.** Truth is also the defence under BNS §356 — quoting someone verbatim makes the imputation true by construction. → `docs/04-legal-and-safety.md`

### 2. Deadpan Prestige
The site should look like the Nobel Committee's website, not a meme page. Serif type, gold foil, zero exclamation marks. **The gap between the gravity of the presentation and the content of the clip is the entire comedic engine.** → `docs/01-concept.md`

Design thesis: **Wisden Almanack redesigned by a central bank.** Dense, typographic, ruled, tabular — guilloché borders, wax seals and foil applied to nonsense with a completely straight face. No hero section, no cards-with-shadows, no gradients, no icon library. → `docs/07-design-language.md`

### 3. Neutrality is engineering, not sentiment
A **Party Parity Meter** on the homepage, source standards, identical vote strength, immutable ballots, audited exclusions, and a public correction ledger. Without mechanically visible neutrality, the site is branded partisan within 48 hours and is dead. → `docs/01-concept.md` §1.5

## The ranking system

```
TEXT-SOURCED → VIDEO VERIFIED → COMMITTEE-PASSED → WATCH 90% + END → ONE FINAL RULING
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

**How ratings work:** each verified account has one immutable ballot per statement,
chosen from 0, 25, 50, 75, or 100 after qualifying playback. Every valid ballot
has equal strength. A ten-vote editorial seed prior prevents a single early vote
from moving the ladder wildly, then fades as public ballots accumulate:
`performance = (10 × seed + ballot sum) / (10 + ballot count)` and
`GP = round(1000 + 10 × performance)`.

**Why the watch gate:** the evidence stays public, but a ballot counts only after
the verified bounded excerpt produces a qualifying playback receipt. The standard
player ignores skipped, replayed, and background-tab time, while server wall-clock
time is the hard ceiling on credit. This is meaningful abuse friction, not proof of
human attention. The transactional vote query—not the browser—enforces one vote,
receipt ownership, publication status, and the current video revision.

## Docs

| File | Contents |
|---|---|
| [`docs/01-concept.md`](docs/01-concept.md) | Positioning, the Verbatim Doctrine, Deadpan Prestige, content policy, naming (and the loaded-word trap) |
| [`docs/02-ranking-system.md`](docs/02-ranking-system.md) | Earlier pairwise design exploration; superseded for scoring by the implemented rules page and voting code |
| [`docs/03-content-pipeline.md`](docs/03-content-pipeline.md) | Embed-never-host, source tiers, the 4-stage pipeline, cold start, multilingual subtitles |
| [`docs/04-legal-and-safety.md`](docs/04-legal-and-safety.md) | **Can we use real names/images?** (yes), BNS §356, publisher-vs-intermediary trap, IT Rules 2026, MCC mode, risk register |
| [`docs/05-growth-and-money.md`](docs/05-growth-and-money.md) | Share-card growth loop, The Weekly Gyan, The Standing Ovations, monetisation, global sequencing |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Phases, architecture sketch, metrics, what could kill this, **decisions needed from you** |
| [`docs/07-design-language.md`](docs/07-design-language.md) | **What "AI-generated" actually looks like and how to avoid it**, the visual thesis, type, colour, materials, layout laws, motion doctrine |
| [`docs/08-information-architecture.md`](docs/08-information-architecture.md) | **Multi-page vs single-page**, routes, page-by-page design, mobile, performance budget, build order |
| [`docs/09-seed-corpus.md`](docs/09-seed-corpus.md) | **The India corpus** — what's in it, the four gates every entry passed, the seeding rubric, **the parity problem**, what's missing, and the research backlog |
| [`data/README.md`](data/README.md) | How to add an entry without breaking the two rules that matter |

## Answering your specific questions

**"Can we use their real names and images, or do we need alternatives?"**
**Real names and images — yes.** The Delhi HC has held that using a public figure's name or image for commentary, satire, parody or news reporting is protected under Art. 19(1)(a) and does not infringe publicity rights. Pseudonyms would make the product *worse* — a caricature is a statement you authored; a verbatim clip is a fact you cited. Two hard limits: **no faces on merchandise** (that's the commercial-exploitation pattern that actually loses in court — sell the *quote* in typography instead), and **no AI-generated likeness, ever.**

**"How do we place a new speech in the right spot?"**
**Seed prior, then public evidence.** The five editorial axes place a new entry on
the seed ladder. Once it is committee-passed and receives valid public rulings,
the frozen seed becomes a ten-vote Bayesian prior and the community gradually
takes control of its live GP.

**"Stars, diamond, gold — all those things?"**
Yes, and made rigorous — fixed rating bands with calibrated rarity, so Kohinoor Class actually stays rare and therefore actually means something. Plus trophy cabinets, form guides, career-arc graphs, auto-conferred honorifics (*"Professor of Applied Physics"*), and a full promotion ceremony with confetti and orchestral sting.

## Current implementation decisions

**Settled:** registered and verified accounts; equal-strength five-position
ballots; one immutable vote per statement; server-timed playback receipts;
Bayesian shrinkage with a published prior; audited admin exclusions; medal tiers
as the satirical presentation; Aamne-Saamne as a non-scoring exhibition.

---

*This project mocks arguments, not accents. Public statements by public figures in public roles — nothing else.*
