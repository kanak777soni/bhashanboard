# 03 — Content Pipeline

> **Current scoring note (July 2026).** References in this design document to pairwise duels, Elo, weighted memberships, or internal placement votes are historical. The implemented authority is `/rules`: one equal-strength, immutable ruling per verified account and statement, after qualifying playback, with a published Bayesian seed prior. Aamne-Saamne is a non-scoring exhibition.

Your plan says *"whenever any politician gives a new foolish speech we rank that speech."* That sentence hides the hardest unsolved problem in the whole idea: **how does a statement get from a rally stage in Gorakhpur into your database within 24 hours, with a source, a transcript, and a translation?**

Solve this and you have a business. Don't solve it, and you have a nice-looking site with 40 clips that nobody revisits.

## 3.1 The critical constraint: **embed, never host**

**Do not store video files. Ever.**

Concrete precedent: **Prasar Bharati has issued YouTube copyright strikes against news channels and journalists for using Parliament footage** — despite parliamentary proceedings themselves being public-domain material. The *proceedings* are public domain; the *broadcast signal* is claimed by Prasar Bharati. Self-hosting clips means you personally receive the strike, the DMCA notice, and the liability.

Embedding means:
- YouTube / X / Facebook serve the bytes, not you
- The rights-holder retains their monetisation and their takedown control — so they rarely bother you
- Zero storage cost, zero CDN cost, zero transcoding cost
- You are pointing at a public source rather than republishing it — much closer to citation than to reproduction

**Clipping without re-hosting:** YouTube embeds accept `start` and `end` parameters. You store `{video_id, start_s, end_s}` and the player shows exactly your 22 seconds. You get precise clipping with none of the copyright exposure. Do the same for other platforms where supported; where not, deep-link with a timestamp.

**Trade-off you accept:** source videos get deleted, go private, or get geo-blocked. Mitigate:
- Nightly **link-health crawler** over every embed; auto-flag dead links
- Store multiple `source_urls` per clip (news channel + party channel + Sansad TV) and fall back automatically
- Keep the **transcript** — it's yours, it's text, it survives, and it's what search and rankings actually run on. A clip with a dead embed degrades to a quoted-text card, not a 404.

> Screen-recording a clip and re-uploading it "for archival" defeats the entire strategy. It is the single most tempting shortcut and the one that gets you struck. Write it into the contributor guidelines.

## 3.2 Source tiers

Contributors must attach a source, and sources are ranked. The tier is displayed on the clip page — it's a credibility signal *and* it's funny to render it as a formal provenance stamp.

| Tier | Source | Notes |
|---|---|---|
| **A — Primary** | Sansad TV, Lok Sabha / Rajya Sabha channels, PIB, state assembly feeds, official party YouTube channels, politician's own verified handles | **Best possible.** When a politician's own party uploads it, "out of context" and "fake" both collapse instantly. Prioritise these above all. |
| **B — Broadcast** | Major news channel uploads (ANI, NDTV, India Today, ABP, Aaj Tak, regional networks) | Reliable, dated, but subject to the channel's own edits — always verify against a longer cut |
| **C — Secondary** | Reputable digital outlets, verified journalist accounts | Acceptable with a corroborating second source |
| **D — Unverified** | Random reuploads, unattributed accounts | **Never publishable.** Usable only as a *lead* to go find an A/B source. |

**Rule: no clip publishes without at least one A or B source.** This one rule eliminates most of your fake-clip and defamation risk in a single line.

## 3.3 The four-stage pipeline

```
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ 1. INGEST    │───▶│ 2. DETECT    │───▶│ 3. VERIFY    │───▶│ 4. PLACEMENT │
   │ monitor +    │    │ ASR +        │    │ human review │    │ 20 duels →   │
   │ crowd submit │    │ LLM triage   │    │ + parity     │    │ ranked       │
   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
      continuous          automated          HUMAN GATE          automated
                                          ⚠ never skipped
```

### Stage 1 — Ingest

**Two inlets, and you need both.**

**(a) Automated monitoring.** Watch ~200 sources continuously:
- Official: Sansad TV, PIB, state assembly channels
- Party channels: all national + major regional parties (keep the list *symmetric* across parties — asymmetric monitoring is how bias enters at the source)
- News: national + regional networks, in every major language
- X/social accounts of MPs, MLAs, ministers, spokespeople

Poll RSS/APIs for new uploads. Pull audio. Cheap and fully automatable.

**(b) Community submission — this is the one that actually scales.**
No team can watch 200 channels in 12 languages. 5,000 motivated users can. The submission form asks for:
- Source URL + start/end timestamp
- Who said it, where, when
- What was claimed (one line, neutral wording)
- Language

Submitters earn reputation, badges, and a permanent credit line on the clip page (*"Sourced by @username"*). Public contributor leaderboard. This is Reddit's and Wikipedia's engine and it is the only realistic answer to India's scale.

### Stage 2 — Detect (automated triage)

- **ASR** over ingested audio. Whisper-class models handle Hindi and most major Indian languages well; regional accuracy varies, so treat output as a draft, never as truth.
- **Diarise + attribute** speakers where possible.
- **LLM triage pass** over transcripts scoring candidate segments for: verifiable factual claims, internal contradiction, category (science/history/economics), and — critically — a **policy pre-filter** that rejects anything touching religion, caste, community, family, health, or appearance before a human ever sees it.
- Output: a ranked candidate queue with proposed clip boundaries.

> **Automated detection never publishes.** It only proposes. This is a hard architectural rule, not a policy preference — see `04-legal-and-safety.md` on why an automated publishing path is a liability disaster.

### Stage 3 — Verify (the human gate)

Every clip passes a human checklist before publication:

- [ ] Source is Tier A or B, link live, timestamp accurate
- [ ] Speaker correctly identified (with office, party, constituency)
- [ ] Date and venue confirmed
- [ ] Transcript accurate; translation accurate; **surrounding 60s captured**
- [ ] Watched the surrounding context — is it still what it looks like? *(Reject rate here will be 30–40%. That's the system working.)*
- [ ] Not synthetic — no AI, no dub, no speed/pitch edit, no suspicious cuts
- [ ] Passes the Rules of the Committee (claims not accents; no religion/caste/family/health/appearance)
- [ ] Not a duplicate of an existing entry
- [ ] Party parity check — does publishing now push any party past 40% of the last 100?
- [ ] Neutral title. **The title states what was claimed, never a verdict.**
  - ✅ *"On radar and cloud cover"*
  - ❌ *"Idiot MP thinks clouds block radar"*

That last line matters more than it looks. Neutral titles are (a) funnier — deadpan always is, (b) far more defensible, and (c) better for search.

### Stage 4 — Placement

Publish → provisional at 1500 GP → high-priority injection into the duel feed → ~20 placement duels → ranked, tier assigned, ceremony fires if Diamond+. See `02-ranking-system.md`.

## 3.4 Cold start — the thing that kills sites like this

**An empty leaderboard is fatal.** Nobody duels 12 clips. Before public launch you need a real corpus.

**Target: 300–500 clips, live, ranked, before anyone outside the team sees the site.**

This is roughly two focused weeks of work and it is not optional. India has a rich, well-documented back catalogue spanning every party and every decade — it is all publicly available and much of it is on official channels.

Seeding rules:
- **≥ 300 clips**, all Tier A/B sourced
- **≥ 60 politicians**, across **≥ 8 parties**, no party above 30%
- **≥ 6 languages**, all with English subtitles
- **≥ 10 states** represented
- **Full tier spread** — seed enough duels internally that the ladder already shows Bronze through Kohinoor. A leaderboard where everything is Gold looks broken.
- **20 fully-built politician profiles** with populated trophy cabinets and career arcs

Run internal/beta duels for ~1 week pre-launch so ratings are already meaningfully spread on day one.

## 3.5 Language — an India-specific requirement, not a nice-to-have

Most Indian political speech happens in a language a given visitor does not speak. A Bengali speaker cannot enjoy a Tamil clip, and vice versa. **Without subtitles your addressable audience is a fraction of India, and cross-state virality — your best growth channel — is zero.**

Requirements:
- **Every clip carries English subtitles.** No exceptions. This is the lingua franca that makes cross-state and diaspora sharing work.
- Hindi subtitles for non-Hindi clips (large addressable audience).
- Machine translation as a **draft**, always community-correctable, always labelled: *"Translation contributed by @user · suggest a correction."*
- Store transcript + translations as structured text — this is what search indexes, what LLM triage reads, and what survives a dead embed.
- Burned-in subtitles on all vertical exports (see `05-growth-and-money.md`).

**Translation correction is an excellent contributor on-ramp.** It's low-effort, high-value, easy to reward, and it recruits exactly the regional-language contributors you need for Stage 1 ingest.

## 3.6 Duplicates, versions and the canonical entry

The same statement will be submitted 15 times from 15 different reuploads. You need one canonical entry per *statement*, with multiple sources attached.

- Fuzzy-match on transcript n-grams + speaker + date to auto-detect duplicates at submission time
- Merge into a canonical clip with a `sources[]` array
- Preserve credit to the **first** submitter, list later ones as corroborators
- Never split a statement's rating across duplicates — that fragments the leaderboard and is the most common way this kind of site rots

## 3.7 Throughput targets

| Phase | New clips/week | Mechanism |
|---|---|---|
| Pre-launch seed | 300–500 total | Manual, in-house |
| Weeks 1–3 (India only) | 20–40 | In-house + early contributors |
| Month 2–3 | 60–100 | Community-dominant + automated triage |
| Month 6+ | 150+ | Community-dominant, human gate scaled with trusted reviewers |

The human gate is your bottleneck by design. Scale it with **trusted community reviewers** (earned via contribution history), not by removing it.
