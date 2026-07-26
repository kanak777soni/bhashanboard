# 06 — Roadmap, Architecture Sketch & Open Decisions

## 6.1 What to build, in order

The ordering principle: **the duel loop is the product.** Everything before it exists to make the first duel possible; everything after it is amplification. If you build profiles, comments, and country tabs before duels work, you will have a pretty site nobody returns to.

### Phase 0 — Foundations (before any public URL)

| | Item |
|---|---|
| 🔴 | Name, domain (.com + .in), registrar + host outside India |
| 🔴 | Incorporate. **Entity on the masthead, never a person.** |
| 🔴 | Data model: `statement`, `source`, `politician`, `party`, `duel`, `vote`, `rating_snapshot`, `moderation_log` |
| 🔴 | Legal pages: ToS, Content Policy (Rules of the Committee), Privacy, Grievance Officer, Notice & Action |
| 🔴 | **Kill-switch** — one-action global unpublish, logged. Test the full 3-hour path. |
| 🟡 | Lawyer engaged (Indian media/tech). Review the publisher-vs-intermediary structure. |

### Phase 1 — Seed & core loop (Weeks 0–3, India only)

| | Item |
|---|---|
| 🔴 | **Seed corpus: 300–500 clips**, Tier A/B sourced, ≥8 parties, ≥6 languages, ≥10 states |
| 🔴 | **Embed-only player** with `start`/`end` clipping |
| 🔴 | Transcript + English subtitles on every clip |
| 🔴 | **Duel screen (*Aamne-Saamne*)** — the single most important screen on the site |
| 🔴 | Elo engine + nightly recompute from immutable vote log |
| 🔴 | Tier system + medals + promotion ceremony |
| 🔴 | Leaderboards: Global, India, This Week, By Party |
| 🔴 | **Party Parity Meter** on the homepage |
| 🔴 | 20 politician profile cards, fully populated |
| 🔴 | **Auto-generated OG share cards** (WhatsApp is the distribution layer) |
| 🔴 | Submission form + moderation queue + human gate checklist |
| 🟡 | Accounts, vote weighting, basic brigade detection |
| 🟡 | Vertical video export pipeline |
| 🟡 | Right of Reply form |

### Phase 2 — Depth (Months 2–3, still India)

| | Item |
|---|---|
| 🔴 | **State leaderboards** — where Indian engagement actually lives |
| 🔴 | Judgment axes + auto-conferred honorifics |
| 🔴 | Career arc graphs, form guides, consistency scores |
| 🔴 | Head-to-head compare (`/compare/a-vs-b`) — big SEO + share surface |
| 🔴 | Contributor reputation, badges, public contributor leaderboard |
| 🔴 | **The Weekly Gyan** newsletter + recap video, automated |
| 🟡 | ASR ingest + LLM triage feeding the queue (proposing only, never publishing) |
| 🟡 | Community translation corrections |
| 🟡 | **MCC / Elections Mode** — must exist before the next election cycle |
| 🟡 | Vote Integrity Report + Neutrality Audit, automated |
| 🟢 | Diamond Membership |
| 🟢 | Quote merch |

### Phase 3 — Expansion (Months 4+)

| | Item |
|---|---|
| 🔴 | Country #2: **USA** (most speech-protective regime; seed 200+ before launch) |
| 🟡 | Country #3: UK |
| 🟡 | **Cross-country duels** — the best global growth feature |
| 🟡 | Hall of Fame + first **Standing Ovations** ceremony (~month 12) |
| 🟡 | Public API + data licensing (journalists/researchers free, commercial paid) |
| 🟢 | Mobile apps (the duel loop is a natural mobile product) |
| 🟢 | Localised trophy tiers per country |

🔴 must-have · 🟡 should-have · 🟢 nice-to-have

## 6.2 Architecture sketch

Deliberately brief — you asked for the idea, not the code. But a few choices are load-bearing and should be decided now because they're expensive to reverse.

| Layer | Choice | Why it's load-bearing |
|---|---|---|
| **Video** | **Embed only.** Store `{platform, video_id, start_s, end_s}`. Never a video file. | Reversing this later means re-sourcing your entire archive |
| **App** | Next.js (SSR for SEO + OG cards) | Share cards and transcript SEO both need server rendering |
| **DB** | Postgres | Ratings, votes, moderation logs all want transactions and a real audit trail |
| **Search** | Typesense / Meilisearch, multilingual analyzers | Transcript search across 10 languages is a core feature, not a bolt-on |
| **Ratings** | Nightly batch recompute from an **immutable vote log** — never mutate ratings in place | This is what lets you retroactively unwind a brigade. Non-negotiable. |
| **Share cards** | Server-rendered images at publish time | Must be automatic; a manual step means missing every viral window |
| **Edge** | Cloudflare | DDoS is a realistic threat for this category |
| **Backups** | Nightly encrypted export to a second jurisdiction | Resilience against a single blocking order |
| **Media** | ASR (Whisper-class) + translation as **drafts**, human/community corrected | Never publish machine output as fact |

**Schema note:** design `country` and `jurisdiction` into every table from day one even though you're India-only for months. Retrofitting multi-country onto a single-country schema is a genuinely painful migration, and it costs you almost nothing to add the columns now.

## 6.3 Metrics that actually matter

Ignore pageviews. Watch these:

| Metric | Why | Healthy signal |
|---|---|---|
| **Duels per session** | The single best proxy for whether the loop works | 15+ |
| **D7 / D30 return rate** | Is this a habit or a one-time laugh? | D7 > 20% |
| **Clips submitted per week** | Is the community engine starting? | Growing without prompting |
| **Submission → publish rate** | Is the human gate calibrated? | 50–70% (too high = you're too lax) |
| **Time from utterance → ranked** | Your core operational promise | < 48h, target < 24h |
| **Party parity (rolling 100)** | Neutrality — the existential metric | No party > 40% |
| **Share-card CTR** | Is distribution self-sustaining? | Rising |
| **Discounted-vote %** | Brigading pressure | Track; publish monthly |

**If duels-per-session is low, nothing else matters.** Fix that before building anything new.

## 6.4 What could kill this — honestly

1. **Being branded partisan.** The most likely death. Once the perception sets, it never reverses. Parity isn't a nice-to-have; it's survival. *Mitigation: enforce it in code and publish the numbers monthly, from week 3.*

2. **A §69A blocking order.** Real and demonstrated in March 2026. *Mitigation: verbatim-only, parity, own domain, offshore host and backups, transparency reports, counsel on retainer, no impersonation ever.*

3. **Content starvation.** Sites like this die when the founder gets bored and the queue empties. *Mitigation: community submission must be working by month 2. Treat contributor recruitment as a product feature, not marketing.*

4. **The joke wearing thin.** Sarcasm alone has maybe a 6-month half-life. *Mitigation: the **ranking system** is the durable product. People return for the ladder, the duels, the movement arrows, their own contributor rank — the way they return to a fantasy league. The sarcasm is the skin, not the skeleton.*

5. **Brigading destroying leaderboard credibility.** If the top 10 is obviously astroturfed, the site is finished. *Mitigation: §2.6, from day one, not "later."*

6. **Founder legal/personal exposure.** *Mitigation: incorporate, entity on the masthead, lawyer on retainer, never your face on the site.*

## 6.5 Decisions I need from you

These change the build, so I'd like your call before writing code:

1. **Name.** My recommendation: **Ovation** (global brand) + *"The Bhashan Board"* (India edition) + **Gyan Points (GP)** as the rating unit + ***Aamne-Saamne*** as the duel. Yes / pick another / propose your own?

2. **Duels vs stars.** I strongly recommend pairwise duels + Elo over star ratings, for the reasons in `02-ranking-system.md`. It's more work up front and much better on every dimension that matters. Confirm?

3. **Verbatim-only, no parody/impersonation.** This is the biggest constraint on your original idea. It removes AI edits, dubs, and re-enactments entirely — but it is what makes the site legally survivable in India right now. Confirm?

4. **Community-submitted from day one, or in-house first?** Community is the only thing that scales, but it needs moderation infrastructure early. My recommendation: in-house for the seed corpus, submissions open at Week 2.

5. **Anonymity.** Do you want to be publicly associated with this? My strong recommendation is **no** — incorporate, put the entity on the masthead, keep your name off it. Given the March 2026 crackdown this is ordinary hygiene, not paranoia.

6. **Budget for a lawyer.** Roughly ₹50k–1.5L for an initial media/tech review in India. I'd treat this as Phase 0, not Phase 3. Is that feasible?

## 6.6 My honest assessment

**The idea is good and the timing is right.** Political meme content is enormous in India and completely unstructured — it lives and dies in WhatsApp forwards. Nobody has built the *permanent, sourced, ranked archive* underneath it. That gap is real.

**Three things turn it from a fun idea into a real product:**

1. **The verbatim doctrine** — sarcasm in the frame, never in the footage. It's what makes it legally survivable, and it's genuinely funnier than editing.
2. **Duels and Elo instead of stars** — turns a browse-once list into a game people return to daily, and produces a leaderboard that means something.
3. **Enforced, published neutrality** — the difference between a site that lasts five years and one that gets branded and buried in five weeks.

**The hardest problem is not legal or technical — it's content throughput.** Everything in `03-content-pipeline.md` exists to answer one question: *can a statement made at a rally this afternoon be sourced, transcribed, translated, verified and ranked by tomorrow?* If yes, you have something. Build the community submission engine earlier than feels comfortable.

Tell me the calls on §6.5 and I'll start building.
