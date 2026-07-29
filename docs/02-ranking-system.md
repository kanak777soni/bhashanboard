# 02 — The Ranking System

> **Historical design note.** The pairwise Elo proposal below is no longer the
> official scoring mechanic. The implemented system uses verified-email
> accounts, a server-timed qualifying playback receipt, one equal-strength fixed
> ballot per statement. Every valid ballot has equal weight, performance is
> their arithmetic mean, and no editorial seed affects public GP or rank.
> Aamne-Saamne is a non-scoring exhibition. See `/rules`, `lib/rating.ts`, and
> `lib/vote-store.ts`.

This is the core product. Everything else is packaging.

## 2.0 Who does the rating — the three-phase rollout

**Decision taken: ratings are internal at launch. Public accounts and public voting come later.**

This is the right call, for four reasons:

1. **You cannot crowd-rank with zero users.** Cold start is unavoidable — someone has to rate the first 500 clips, and that someone is you.
2. **The first 500 clips set the tone forever.** Editorial control over the seed corpus is worth more than early crowd input.
3. **It cuts launch scope by roughly 40%.** No accounts, no auth, no vote weighting, no brigade detection, no abuse queue. All of that moves to Phase B.
4. **It is more on-brand, not less.** An anonymous, po-faced jury handing down medals is *more* Nobel-like than crowd voting. **"Ratified by the Committee"** is funnier than "4.7 stars from 8,201 users."

### The one thing you must get right

> **Use pairwise duels internally too — not 1-to-10 scores.**

This is the whole trick. If internal raters assign numbers, you get scale drift (one rater's 8 is another's 6), agonising over each score, and a schema you have to throw away when the public arrives. If they duel, you get:

- **No inter-rater calibration problem.** "Which of these two?" is universal in a way "how bad is this, 1–10?" never is.
- **Speed.** A duel takes 5 seconds. A considered 1–10 score takes a minute.
- **Zero migration later.** Public voting is the *same table*, same Elo engine, with `voter_type = 'public'` instead of `'committee'`. Phase B is a config change, not a rewrite.

**Throughput check:** 30 new clips/week × 20 placement duels = 600 duels/week, split across 4 raters = 150 each ≈ **20 minutes per person per week.** Entirely manageable. Even at 100 clips/week it's about an hour each.

### The three phases

**Phase A — The Committee** *(launch → ~month 3)*
- 3–7 internal raters. Admin-only duel screen. Nothing public-facing but the results.
- Every clip carries the seal: *"Ratified by the Committee."*
- Publish a **rating rubric** so the judgment is transparent and criteria-based, not arbitrary. This matters legally — see `04-legal-and-safety.md` §4.2.

**Phase B — The Advisory Ballot** *(~month 3–5)*
- Accounts open. Users duel. **Their votes do not move the rating yet.**
- Both results shown side by side:
  ```
  COMMITTEE RULING   💎 Diamond Gyan · 1,812 GP
  PUBLIC BALLOT      👑 Kohinoor Class · 61% of 4,209 ballots
  ```

This phase is disproportionately valuable and almost nobody does it:

  1. **Zero risk.** You cannot be brigaded into a corrupt leaderboard, because the ballots don't count yet.
  2. **You collect adversarial data before it matters.** Brigading attempts arrive, you measure them, and you tune weighting and detection against *real* attack traffic — with nothing at stake.
  3. **The divergence is content.** *"The Public disagrees with the Committee on 34 entries"* is a whole leaderboard, and it's funny: *"The Committee has noted the public's opinion and thanks them for it."*
  4. **Full engagement immediately.** Users don't know or care that their ballot is advisory. The duel loop — your retention engine — works from day one of Phase B.
  5. **It tells you when to promote.** Track the correlation between Committee Elo and public Elo. When they track closely and abuse detection is holding, the public pool has earned weight.

**Phase C — Blended, then public-led** *(~month 6+)*
- `rating = w_c × committee + w_p × public`. Start `w_p = 0.2`, raise as integrity holds.
- The Committee keeps a veto and retains moderation authority; the public increasingly drives the number.
- **This is also your legal de-risking path, not just a growth feature** — the more the ranking is a published function of public votes, the weaker the "you are the publisher of this judgment" argument. Move through it deliberately.

### What this changes in the build

| | Phase A (launch) | Phase B/C |
|---|---|---|
| Accounts / auth | ❌ not needed | ✅ |
| Vote weighting | ❌ | ✅ |
| Brigade detection (§2.6) | ❌ | ✅ **build during Phase B, on live attack data** |
| Duel screen | ✅ admin-only, can be crude | ✅ public, polished |
| Elo engine | ✅ identical | ✅ identical |
| Schema | ✅ **include `voter_type` and `weight` from day one** | no migration |

That last row is the only thing you must not forget. Adding two columns now costs nothing; retrofitting them onto a live ratings table is painful.

---

## 2.1 The problem with star ratings

Your plan said: *"whenever any politician gives a new foolish speech we rank that speech and place it on the right spot."*

The obvious implementation — 1-to-5 stars, sort by average — fails badly:

- **Bunching.** Everything settles at 4.6–4.9. No usable ordering. The leaderboard becomes noise.
- **Trivially brigadable.** An IT cell can mass-1-star a rival's clips in an afternoon.
- **Cold start is broken.** A new clip with 3 votes at 5.0 outranks a classic with 40,000 votes at 4.8.
- **It's boring.** Rating something is a chore. Nobody comes back for it.

## 2.2 The upgrade: pairwise duels + Elo

> **Show two clips side by side. Ask one question: *which one is more magnificent?* Update both ratings. Repeat.**

This is how chess ranks players, how LMArena ranks models, and how the original Facemash worked. It is the single biggest improvement I can make to your idea.

**In India, call it *Aamne-Saamne* — "face to face."**

### Why it wins on every axis

| | Stars | Duels + Elo |
|---|---|---|
| Produces a clean total order | ❌ bunching | ✅ ratings spread naturally |
| Fun / repeatable | ❌ a chore | ✅ genuinely addictive — one more, one more |
| Session time | Low | **High** (this is your retention engine) |
| Brigadable | ✅ trivially | ❌ you can't choose your matchups |
| Cold-start ready | ❌ | ✅ placement matches (see below) |
| Serves clips users haven't seen | ❌ | ✅ **the duel feed is also the discovery feed** |

The duel screen is your homepage-after-login, your mobile app, and your growth loop all at once. Users think they are playing a game. They are labelling your dataset.

### Mechanics

```
rating_new = rating_old + K × (actual − expected)
expected_A = 1 / (1 + 10^((rating_B − rating_A) / 400))
```

- Everything enters at **1500 GP**.
- **K = 40** while provisional (< 20 duels), **K = 20** after, **K = 10** once a clip has > 500 duels (stabilises classics).
- Voter weight `w` (see §2.6) scales K: `K_effective = K × w`.
- Recompute nightly from the immutable vote log, so a fraud sweep can retroactively unwind a brigade.

### Matchmaking: never random, never chooseable

Pair selection is the anti-abuse mechanism. Rules:

1. **Users can never request a matchup.** No "duel this clip." Server picks.
2. **Rating proximity** — pair clips within ~±150 GP. Close matches carry the most information.
3. **Uncertainty priority** — clips with the fewest duels get shown most.
4. **Cross-party bias** — where possible, pair clips from *different* parties. This is quietly brilliant: it forces every voter to make a direct comparative judgment across party lines instead of loyally upvoting their side. It measurably improves rating quality **and** it's the funniest possible framing: *"Aamne-Saamne: BJP vs INC. You decide."*
5. **Recency injection** — ~20% of duels always include a clip from the last 7 days, so new material gets placed fast.
6. **Language matching** — don't pair a Tamil clip against a Hindi clip for a Hindi-only voter; respect the user's subtitle languages.

## 2.3 Answering your exact question: "place it on the right spot"

**Placement matches.** Straight from chess and from ranked ladders in games — the mechanic users already understand.

```
NEW CLIP PUBLISHED
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 🟡 PROVISIONAL — awaiting placement             │
│ Entered at 1500 GP. Unranked.                   │
│ Placement matches: ███████░░░░░░  12 / 20       │
│ Projected tier: 🥇 Gold Standard                │
└─────────────────────────────────────────────────┘
       │  ~6–24 hours, injected into the duel feed at high priority
       ▼
┌─────────────────────────────────────────────────┐
│ ✅ RANKED — #47 Global · #12 India · 🥇 Gold    │
│ 1,684 GP  ▲ new entry                           │
└─────────────────────────────────────────────────┘
```

The provisional period is **content in itself**. It creates a live, watchable event every time a politician says something notable:

- A homepage strip: *"⏱ NOW IN PLACEMENT — 3 statements are being ranked."*
- A push notification: *"A new entry is climbing. Currently projected: Diamond."*
- Post-placement fanfare: *"🎺 NEW ENTRY AT #12. The Committee is impressed."*
- A share card the moment it settles.

This turns your ranking system from a static list into a **live sport**. That is the difference between a site people visit once and a site people check daily.

### Leaderboard movement

Show it like a football league table — deltas are what make a table feel alive.

```
#  ▲▼   CLIP                                    GP     TIER
1   —    "Cloud cover will block radar"        1,947   👑
2  ▲2    "Genes of the Bharatiya..."           1,921   👑
3  ▼1    "Potato factory"                      1,918   👑
4  ▲7    "Nobody knows what happened..."       1,890   💎  🔥 NEW
```

Recompute nightly; animate the deltas on load. `▲7` next to a clip is a reason to open the site tomorrow.

## 2.4 Tiers — the "stars, diamond, gold" you asked for

Rarity is what makes tiers feel valuable. Fixed rating bands, calibrated so the top tiers stay genuinely scarce.

| Tier | Name | Band (GP) | Target rarity | Presentation |
|---|---|---|---|---|
| 🪵 | **Participation Certificate** | < 1300 | ~28% | Grey, matte, faintly sad |
| 🥉 | **Bronze Bhashan** | 1300–1449 | ~24% | Bronze |
| 🥈 | **Silver Tongue** | 1450–1599 | ~21% | Silver |
| 🥇 | **Gold Standard** | 1600–1749 | ~16% | Gold foil, embossed |
| 💎 | **Diamond Gyan** | 1750–1874 | ~8% | Refracting, animated |
| 👑 | **Kohinoor Class** | 1875+ | ~2.5% | Full ceremony, confetti, fanfare |
| 🏛 | **Hall of Fame** | inducted | ~50 all-time | Retired from active duelling |

**Kohinoor Class** is the perfect Indian top tier: the most famous diamond in the world, and everyone knows the joke about where it currently lives. Tagline: *"So valuable it had to be kept abroad."*

**Hall of Fame / "Retired Hurt"** — once a year, the Committee retires ~5 all-time entries from active duelling into a permanent gallery. This solves a real problem (the same 10 legendary clips dominating the ladder forever) *and* creates an annual ceremony moment.

### Ceremony on promotion

When a clip crosses into Diamond or Kohinoor:
- Full-screen takeover, gold foil animation, orchestral sting, confetti
- Auto-generated share card and vertical video
- Push notification to followers of that politician
- Entry in the daily digest: *"The Committee has elevated one statement to Kohinoor Class."*

Treat it with the seriousness of an Oscars envelope. That's the joke.

## 2.5 Judgment axes — why the data is actually good

Elo gives you one number. The **axes** give you the texture, the filters, the honorifics, and a genuinely valuable dataset.

After voting in a duel, the user may (optionally, one tap) tag *why*:

| Axis | Question | What it powers |
|---|---|---|
| 🧠 **Logic Damage** | Was reality harmed? | "Science & Reason" category |
| 🎭 **Straight Face** | Delivered with total conviction? | The "Deadpan" leaderboard |
| 🔁 **Rewatch Value** | Meme potential? | The Reels/Shorts export queue |
| 👏 **Crowd Complicity** | Did the audience *applaud*? | "Standing Ovation" category — the darkest and best one |
| 📉 **Consequence** | What happened afterwards? | The "Promoted Anyway" leaderboard |

Optional, one-tap, never blocking the vote. Even at 15% tag rate you get enough signal.

The 👏 **Crowd Complicity** axis is the sharpest thing in this design. It quietly shifts the target from *"this one politician is foolish"* to *"look at the room applauding"* — which is better satire, much harder to sue over, and much harder to call partisan.

## 2.6 Anti-brigading (do not skip this)

**Organised political vote manipulation in India is not a hypothetical.** Every major party runs volunteer digital operations. If your leaderboard can be gamed, it *will* be gamed within a week of getting attention, and once the leaderboard is obviously rigged the site is dead.

Defence in depth:

1. **Duels are unchooseable.** The strongest defence — you cannot target what you cannot select. (This alone is why duels beat stars.)
2. **Weighted votes.** `w = f(account age, duels completed, agreement-with-consensus history, verified email/phone)`. New accounts start at `w = 0.1` and earn up. Never announced precisely.
3. **Bayesian shrinkage.** Low-duel clips are pulled toward 1500 in *displayed* rank until confidence is met.
4. **Coordination detection.** Flag clusters by: signup-time burst, ASN/IP-range concentration, near-identical voting vectors, inhuman inter-vote timing, referrer clustering. Flagged cohorts get `w → 0` **silently and retroactively** — nightly recompute unwinds their influence.
5. **Honeypot duels.** Occasionally serve a pair where both clips are from the same party. A user whose "judgment" flips entirely based on party label rather than content is measurable.
6. **Rate limits** — diminishing weight after ~50 duels/day per account.
7. **Immutable vote log.** Never mutate ratings in place. Always recompute from the log so any fraud finding can be applied backwards.

### Make the defence into content

Publish a monthly **Vote Integrity Report**, deadpan:

> *"In June, the Committee discounted 41,208 ballots originating from 2,140 accounts created within the same nine-minute window. We thank them for their enthusiasm. Party attribution of discounted ballots: 38% / 33% / 29%. Once again, admirably balanced."*

This is funny, it is a trust signal, it deters the next attempt, and it is free press.

## 2.7 Politician profiles — the "player card"

Model these on **cricket stat cards / FIFA Ultimate Team**, not on Wikipedia. Card first, prose never.

```
┌────────────────────────────────────────────────────┐
│  [official photo]        RAJESH ▮▮▮▮▮▮             │
│                          MP · Party · State         │
│  ══════════════════════════════════════════════    │
│  CAREER GP        18,447        GLOBAL RANK   #14   │
│  PEAK RATING       1,921 👑     NATIONAL      #6    │
│  ENTRIES INDEXED      63        PARTY          #2   │
│  ──────────────────────────────────────────────    │
│  FORM (last 5)   👑 💎 🥇 💎 🥈                     │
│  CONSISTENCY     ████████░░  "Remarkably reliable"  │
│  ──────────────────────────────────────────────    │
│  🏆 TROPHY CABINET                                  │
│     👑 ×2   💎 ×7   🥇 ×14   🥈 ×22   🥉 ×18       │
│  ──────────────────────────────────────────────    │
│  🎓 HONORIFICS (conferred by the Committee)         │
│     "Professor of Applied Physics"                  │
│     "Whataboutery — Regional Champion"              │
│  ──────────────────────────────────────────────    │
│  📈 CAREER ARC  ▁▂▃▅▄▆█▇█   [10-year rating graph] │
│  ──────────────────────────────────────────────    │
│  💬 RIGHT OF REPLY:  Office has not responded.      │
│  [ ⚔ Compare with another representative ]         │
└────────────────────────────────────────────────────┘
```

Details that make it sing:

- **Career arc graph.** A 10-year rating line is *genuinely* interesting and gets screenshotted constantly.
- **Form guide** — last 5 tiers, cricket-style. Instantly readable.
- **Consistency** = inverse std-dev of clip ratings. Low variance + high mean = *"Remarkably reliable."* High variance = *"Streaky."*
- **Auto-honorifics** derived from axis dominance. Never hand-written — the algorithm confers them, which is both funnier and safer:
  - Logic Damage + science tags → *"Professor of Applied Physics"*
  - History tags → *"The Time Traveller"*
  - Economics tags → *"Chief Economist"*
  - Deflection tags → *"Whataboutery — Regional Champion"*
  - Zoology/biology tags → *"Fellow of the Royal Society (self-appointed)"*
- **Head-to-head compare.** Two cards side by side. Enormous share value, especially for rivals in the same seat.
- **Right of reply**, always visible, always pinned when used. See `04-legal-and-safety.md`.

## 2.8 Leaderboards

Every one of these is a separate landing page, a separate SEO surface, and a separate weekly share card.

| Type | Examples |
|---|---|
| **Geography** | 🌍 Global · 🇮🇳 India · State (UP, Bihar, TN, WB, MH…) · Constituency |
| **Time** | Today · This week · This month · This year · All-time |
| **Party** | Party ladders + the **Party Parity Meter** |
| **Language** | Hindi · English · Tamil · Telugu · Bengali · Marathi · Kannada · Malayalam · Gujarati · Punjabi |
| **Category** | Science & Reason · History · Economics · Whataboutery · Standing Ovation (crowd applauded) |
| **Special** | Rising Star (fastest climb) · Rookie of the Year (debut < 90 days) · Consistency Award · Promoted Anyway |

**Start with Global + India + Party + This Week.** Everything else is a Phase 2 unlock — an empty leaderboard is worse than no leaderboard.

**State-level ladders are where Indian engagement actually lives.** "UP vs Bihar" is a real rivalry with real audience. Prioritise state ladders over country expansion in Phase 2.

## 2.9 Global vs. country ranking

Your plan has "Global" and "Countries" as toggles. Two things to get right:

1. **Never cross-rank different countries in a shared Elo pool** until you have real cross-country duel volume — the pools won't be comparable and the global table will be nonsense. Until then, "Global" = a *merged view* of nationally-normalised ratings, clearly labelled as such.
2. **Once you have volume, cross-country duels become the best feature on the site.** *"Aamne-Saamne: India 🇮🇳 vs USA 🇺🇸."* That is an internationally shareable format and your single best global growth mechanic. Design the schema for it from day one even though you won't ship it for months.
