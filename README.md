# The Bhashan Board *(working title)*

> **A permanent, sourced, ranked archive of the things politicians actually said — presented with the total institutional seriousness of an international awards committee.**

India first. Then the world.

**Status:** pre-launch application with a 45-entry source corpus, registered accounts, verified-email authentication, server-timed video-gated one-time public rulings, an auditable equal-weight public rating model, reader evidence submissions, and administrator user controls. Every current corpus entry is still text-sourced, so public voting remains correctly locked until verified excerpts are attached.

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
current JSON corpus without deleting remote rows, and then verifies document
hashes, foreign-key-backed records, exact source artifacts, the statement ID
sequence, rating aggregates, publication guards, submission tables, and the
append-only audit ledger. Each phase commits separately, so test migrations on
a disposable Neon branch and take a production backup before running the
command. It is safe to run again after a successful rollout: unchanged rows
are not rewritten. A row edited through the admin is protected from later seed
imports and must be reconciled manually if its local JSON counterpart changes.

For production, copy every required value documented in `.env.example` into the
hosting environment. Never expose `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BREVO_API_KEY`, or any `CLOUDINARY_*` value through a `NEXT_PUBLIC_` variable.
Vercel invokes the bearer-protected retention route daily to remove expired
sessions, verification records, rate-limit buckets, stale unfinished watch
sessions, and eligible unattached video assets.

## Brevo email and the first administrator

The application has no built-in admin username, admin email, or
`ADMIN_PASSWORD`. An administrator is an ordinary verified account whose role
has been promoted in Neon:

1. In Brevo, verify the exact sender address in `BREVO_SENDER_EMAIL`, or
   authenticate its domain. Create a Brevo API key with transactional-email
   access.
2. Set the required `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` values locally and
   in Vercel. `BREVO_SENDER_NAME` is optional and defaults to
   `The Bhashan Board`. The four `BREVO_*_TEMPLATE_ID` values are also optional;
   when omitted, the application sends its built-in verification, reset, and
   welcome messages plus evidence-submission acknowledgements. Leave them unset
   unless tested: verification and reset templates receive
   `{{ params.name }}` and `{{ params.actionUrl }}` (and must render
   `actionUrl` as a clickable link); the welcome template receives
   `{{ params.name }}` and `{{ params.siteUrl }}`; the submission template
   receives `{{ params.name }}`, `{{ params.reference }}`, and
   `{{ params.siteUrl }}`.
3. Set `BETTER_AUTH_SECRET` to a stable random secret of at least 32 bytes. Set
   `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin in
   production, with no trailing slash.
4. Deploy, register normally with the email that should own the first admin
   account, and open the Brevo verification link.
5. From a trusted terminal whose `DATABASE_URL` or `MIGRATION_DATABASE_URL`
   points at that Neon database, run:

```bash
npm run admin:promote -- verified-user@example.com
```

Use the account's email in that command; the display name is not a login
username. Sign in again if an existing session does not immediately show the
administrator navigation. That first administrator can manage and promote
other verified users in `/admin/users`. There is no shared browser password or
network-facing bootstrap endpoint. Newsletter consent remains only in Neon; it
is not copied into a Brevo marketing contact list.

## Cloudinary video setup

YouTube excerpts remain supported. Administrators can also upload a
rights-cleared MP4, MOV, or WebM file directly from the browser to Cloudinary;
the video bytes do not pass through Vercel. The server issues short-lived,
administrator-bound signed upload parameters. Cloudinary retains the original
as an `authenticated` asset. The server first validates Cloudinary's
authoritative identity, byte, format, duration, and visual-dimension metadata;
only then does it request the H.264/AAC MP4 derivative asynchronously. A trusted
administrator must play that derivative through completely and approve its
picture and audio before it can be attached to a statement.

1. In Cloudinary, copy the **cloud name**, **API key**, and **API secret** from
   the API Keys page.
2. Under **Settings → Upload → Upload presets**, create a preset for video
   uploads. Set its signing mode to **Signed**, delivery type to
   **Authenticated**, allowed formats to `mp4,mov,webm`, and maximum file size
   to **52,428,800 bytes (50 MiB)**. Allow the request's custom public ID, and
   leave folder/public-ID prefix rewriting plus eager/incoming
   transformations empty—the application signs the exact private ID and its
   single derivative request only after validating the original. Give it
   a stable name such as `bhashanboard-video`.
3. Add these four non-public environment values from `.env.example` both locally and in
   Vercel:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_VIDEO_UPLOAD_PRESET=bhashanboard-video
```

4. Redeploy after adding or changing the values. Do not create
   `NEXT_PUBLIC_CLOUDINARY_*` variables, do not use an unsigned upload preset,
   and do not put the API secret in browser code. Cloudinary's upload endpoint
   already supports direct browser uploads; no bucket CORS policy, public
   bucket, custom media domain, or webhook is required for this flow.

Before issuing an upload, the server reads that preset through Cloudinary's
Admin API and fails closed if it is unsigned, public, too large, accepts other
formats, rewrites IDs/folders, or contains merged transformations. This protects
the account from a mistyped or later-edited preset.

The preset enforces file type and byte size. It cannot reject by duration or
visual dimensions, so the browser's three-minute check is only an early
convenience: the server
authoritatively rejects any asset whose Cloudinary metadata reports a duration
over three minutes, has no visual stream, or exceeds the bounded 4K pixel
envelope. Hosted originals remain authenticated rather than being renamed
public. Playback uses signed delivery URLs for the normalized H.264/AAC MP4
derivative.

Neon keeps the actor, quota, expiry, Cloudinary asset identity and version,
provider metadata, playback approval, and statement-attachment state for each
intent. Attaching a hosted clip and saving its statement happen in one database
transaction; replacing or removing it marks the previous upload detached. Each
authorization conservatively reserves 50 MiB against a 500 MiB rolling
24-hour allowance (so at most ten new authorizations can be issued per
administrator in that window), with a four-active limit. Eligible rejected,
expired, or orphaned authenticated assets are deleted only after signed-upload
replay has expired and a durable database claim exists. Cleanup targets
Cloudinary's immutable asset ID, retries idempotently, and records the outcome
in the audit ledger.

---

## The plan in one page

| | |
|---|---|
| **What it is** | A league table for public political statements. Unedited clips, community-ranked, awarded medals. |
| **The joke** | Not the clips — the *frame*. Gold foil, wax seals, roman numerals, orchestral fanfare, a straight-faced committee awarding **Kohinoor Class** to a real quote about clouds blocking radar. |
| **The mechanic** | Watch a verified excerpt → enter one of five fixed rulings once → exact equal-weight performance → GP, tiers, and standings after ten rulings. *Aamne-Saamne* remains a non-scoring exhibition. |
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

| Class | Name | Public GP band |
|---|---|---|
| 🪵 | Participation Certificate | 1000–1299 |
| 🥉 | Bronze Bhashan | 1300–1449 |
| 🥈 | Silver Tongue | 1450–1599 |
| 🥇 | Gold Standard | 1600–1749 |
| 💎 | Diamond Gyan | 1750–1874 |
| 👑 | **Kohinoor Class** | 1875–2000 |
| 🏛 | Hall of Fame | Formal induction after 25 votes and Kohinoor Class |

*Kohinoor Class: so valuable it had to be kept abroad.*

**How ratings work:** each verified account has one immutable ballot per statement,
chosen from 0, 25, 50, 75, or 100 after qualifying playback. Every valid ballot
has exactly equal strength. `performance = ballot sum / valid ballot count` and
`GP = round(1000 + 10 × performance)`. A clip can collect provisional rulings
immediately, but it does not enter public Standings until ten valid rulings
exist. The public Sarcasm Profile describes Logic Break, Straight-Face
Delivery, Replay Value, Crowd Complicity and No Consequence; these editorial
marks never alter public GP, class, rank or starting place.

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
| [`docs/03-content-pipeline.md`](docs/03-content-pipeline.md) | Embed-first evidence, controlled rights-cleared Cloudinary hosting, source tiers, the 4-stage pipeline, cold start, multilingual subtitles |
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
**Publish the evidence, then let ten public rulings establish placement.** A new
clip starts unranked. After qualifying playback, every verified account may
enter one final equal-strength ruling. The arithmetic mean becomes performance;
the statement joins Standings only when it reaches ten valid rulings.

**"Stars, diamond, gold — all those things?"**
Yes. Keep the satirical names rather than generic labels such as beginner or
legend: they are part of the joke, while the number underneath remains
transparent. The GP bands are fixed and published; they do not promise an
artificial rarity distribution or move to force a preferred outcome.

## Current implementation decisions

**Settled:** registered and verified accounts; equal-strength five-position
ballots; one immutable vote per statement; server-timed playback receipts;
exact arithmetic-mean performance with no editorial prior; a ten-ruling public
rank threshold; audited admin exclusions; medal classes as the satirical
presentation; 25-vote Kohinoor eligibility for Hall induction; Aamne-Saamne as
a non-scoring exhibition.

---

*This project mocks arguments, not accents. Public statements by public figures in public roles — nothing else.*
