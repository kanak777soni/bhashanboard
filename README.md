# The Bhashan Board *(working title)*

> **A permanent, sourced, ranked archive of the things politicians actually said — presented with the total institutional seriousness of an international awards committee.**

India first. Then the world.

**Status:** pre-launch application with a 45-entry source corpus, registered accounts, verified-email authentication, server-timed video-gated one-time public rulings, an auditable Bayesian rating model, and administrator user controls. Every current corpus entry is still text-sourced, so public voting remains correctly locked until verified excerpts are attached.

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

## Cloudflare R2 video setup

YouTube excerpts remain supported. Administrators can also upload a
rights-cleared, already-trimmed MP4 from the browser into a **private quarantine
bucket**; the video bytes do not pass through Vercel and are not publicly
reachable while untrusted. The server streams and SHA-256 hashes the complete
object under an ETag precondition while retaining only the first 8 MiB for a
structural fast-start MP4 inspection (including H.264/AAC declarations and
duration tables). That inspection is not a full decoder pass. Only then does it
copy the object to a separate public delivery bucket under a deterministic
`statement-videos/<sha256-prefix>/<sha256>.mp4` key, verify the final HEAD
response, and require the trusted administrator to play the promoted object
through completely and approve its picture and audio before attachment. Neon
records both approvals, and quarantine is removed best-effort. The single-PUT
ETag remains conditional-transfer metadata, not the content identity.

1. Create two **Standard** R2 buckets: a private quarantine/upload bucket and a
   separate public delivery bucket. Never attach a public domain or `r2.dev` URL
   to the quarantine bucket.
2. Create one least-privilege R2 S3 token with Object Read & Write access scoped
   **only** to those two buckets. It needs to PUT/GET/HEAD/DELETE quarantine
   objects and COPY/HEAD public objects; do not grant account-wide admin. The
   application deliberately has no automatic public-object deletion path.
3. Connect a public HTTPS custom domain only to the delivery bucket. Use that
   origin for `R2_PUBLIC_BASE_URL`; do not use `r2.dev` in production.
4. Add all six `R2_*` values from `.env.example` locally and in Vercel before
   deploying.
5. Give the private upload bucket this exact-origin CORS policy. No `GET` or
   `HEAD` browser access is needed:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-site.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "if-none-match", "cache-control", "x-amz-meta-upload-intent"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

6. Give the public delivery bucket exact-origin `GET` and `HEAD` CORS with the
   `range` request header and expose `etag`, `content-length`, `content-range`
   and `accept-ranges` for native playback.
7. Enable an R2 **bucket-lock retention rule** for the public
   `statement-videos/` prefix for at least seven days. This backs the
   content-addressed, application-level write-once rule with provider-side
   protection. A longer or indefinite lock is compatible with the application;
   choose it only after deciding how legal takedowns will be handled.

Use HandBrake's **Web Optimized** option or equivalent before upload. Neon keeps
actor, quota, expiry, status, SHA-256, ETag, duration, promotion, playback
approval, and statement-attachment metadata for each intent. Attaching a new
hosted clip and saving its statement happen in one database transaction;
replacing or removing it marks the previous upload detached. Each administrator
is limited to four concurrent authorizations, 20 intents and 500 MiB of
authorized bytes per rolling 24 hours. The daily job removes
completed/rejected/expired quarantine objects and old untracked quarantine
bytes. Every quarantine deletion is scheduled in a durable Neon outbox before
R2 is touched, then completed and audited atomically; a lost response is retried
idempotently. A promoted final that remains unattached for 24 hours is marked
and written to the audit ledger so storage drift is visible. Public evidence
objects are never deleted automatically, because even a reference check can
race a new statement save or an identical re-upload. Never add an age-only
lifecycle rule for `statement-videos/`; any future public deletion must be an
explicit, audited operation coordinated with statement records and legal
retention.

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
| [`docs/03-content-pipeline.md`](docs/03-content-pipeline.md) | Embed-first evidence, controlled rights-cleared R2 hosting, source tiers, the 4-stage pipeline, cold start, multilingual subtitles |
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
