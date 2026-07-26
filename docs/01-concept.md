# 01 — Concept, Positioning & Name

## 1.1 The one-line pitch

> **A permanent, sourced, ranked archive of the things politicians actually said — presented with the total institutional seriousness of an international awards committee.**

Not a meme page. Not a parody channel. A **league table for public statements**, where the humour comes entirely from how solemnly it is presented.

## 1.2 The single most important design decision

Your original framing was "we show foolish speeches and rank them." That framing is fun but it is legally and editorially fragile, because *we* are the ones calling it foolish.

The upgrade — and everything else in this plan depends on it:

> ### The Verbatim Doctrine
> **We never edit the claim. We only decorate it.**
>
> - Every clip is **unedited, in-context, and source-linked**.
> - We never add words, never dub, never impersonate, never re-enact, never AI-generate.
> - The politician's own audio and own face, from a public, citable source, with a timestamp.
> - **All sarcasm lives in the chrome** — the medals, the tier names, the trophy cabinet, the commentary, the award-show typography. Never in the claim itself.

Why this is the whole ballgame:

| Risk | Parody/impersonation site | Verbatim + scoreboard site |
|---|---|---|
| Defamation (BNS §356) | You made a statement about them → you must defend it | You quoted them verbatim → **truth is the defence** |
| §69A blocking | Directly matches what was blocked in March 2026 | Much harder to characterise as unlawful |
| Deepfake rules (IT Amendment Rules 2026) | Squarely in scope, heavy labelling burden | **Out of scope entirely** — nothing is synthetic |
| "Out of context!" attack | No answer | One-click "watch 60s before & after" |
| Press credibility | Meme account | Citable archive journalists actually use |

The sarcasm doesn't get weaker. It gets **stronger**, because a straight-faced gold medal awarded to a real, unedited quote is funnier than any edit you could make. The joke is the frame, not the footage.

## 1.3 Design thesis: **Deadpan Prestige**

The site should not look like a meme site. It should look like the **Nobel Committee's website**, or the ICC rankings page, or a central bank's annual report.

- Serif headlines. Gold foil. Wax seals. Roman numerals. Laurel wreaths.
- Language of officialdom: "The Committee has reviewed…", "Ratified by public ballot", "Provisionally ranked pending placement matches."
- Zero exclamation marks. Zero "LOL". Zero emoji in editorial copy (emoji only as tier glyphs).
- Awards ceremony fanfare and confetti — but rendered with total sincerity.

**The contrast between the gravity of the presentation and the content of the clip is the entire comedic engine.** If the site ever looks like it is winking, the joke dies and the legal exposure goes up.

### Sample micro-copy (tone calibration)

| Surface | Copy |
|---|---|
| Tagline | *"An archive of public wisdom. Independently ranked."* |
| 404 | *"This page does not exist. Unlike the statements on this website, which are unfortunately real."* |
| Loading | *"Consulting the panel of experts…"* |
| Vote confirmed | *"Your judgment has been recorded and will be weighted accordingly."* |
| Empty search | *"No results. Rare, but it happens."* |
| Cookie banner | *"We use cookies. Considerably fewer than the promises indexed on this site."* |
| Newsletter CTA | *"The Weekly Gyan. Every Sunday. Unsubscribe anytime — a privilege you do not have with your MP."* |
| Context button | *"Watch 60 seconds before and after. (The context does not help.)"* |
| Right of reply | *"This politician's office has responded. We have pinned it, because we are aggressively fair."* |

## 1.4 The content policy that is also the brand

Publish this as a visible page. It is simultaneously your ethics, your legal armour, and your positioning.

> ### The Rules of the Committee
>
> **We rank arguments, not accents.**
>
> 1. **Claims and reasoning only.** We index what a politician *asserted* or *reasoned*. We never index a stammer, a slip of the tongue, a mispronunciation, an accent, or an English-fluency error.
> 2. **Nothing personal.** No family, no health, no appearance, no private life, no religion, no caste, no community.
> 3. **Never synthetic.** No AI generation, no dubbing, no re-enactment, no impersonation, no speed/pitch edits. Ever.
> 4. **Public figures, public functions.** Only elected representatives, candidates, office-bearers and ministers — speaking publicly, in their public role.
> 5. **Full context, always.** Source link, date, venue, full transcript, and the surrounding minute.
> 6. **Equal opportunity.** Party balance is enforced in the queue, published on the homepage, and audited monthly.
> 7. **Right of reply.** Any verified office may respond. Their response is pinned to the clip, permanently, unedited.
> 8. **We keep score of ourselves.** Every removal, correction and re-contextualisation is logged publicly, forever.

Rule 1 is the one people underestimate. Mocking someone's English is (a) cheap, (b) classist, (c) unfunny after the third time, and (d) precisely the thing that gets a site branded as elitist and dismissed. Mocking a confident false claim about physics, history or economics is timeless, defensible, and self-renewing.

## 1.5 Neutrality is an engineering constraint, not a value statement

An India-focused "foolish speech" site will be branded as anti-one-party within 48 hours unless neutrality is **structurally enforced and visibly measured**. Once branded, you get review-bombed, brigaded, FIR'd, and eventually blocked.

Build it in:

- **Party Parity Meter** — a live widget on the homepage: *"Equal Opportunity Index: BJP 31% · INC 29% · Regional 33% · Other 7%. We are aggressively fair."*
- **Queue balancing** — if any party exceeds ~40% of the last 100 published clips, the editorial queue prioritises others until parity restores. Publish this rule.
- **Reviewer diversity** — moderators self-declare no party affiliation; rotate reviewers across clips.
- **Monthly Neutrality Audit** — a public post with the numbers. Make it a running bit: *"This month we disappointed everyone equally. Report attached."*

### ⚠️ The loaded-word trap

Do **not** build the brand on partisan attack vocabulary. These words instantly assign you to a side:

| ❌ Avoid | Why |
|---|---|
| *Jumla*, *Feku*, *Chowkidar* | Anti-BJP coded |
| *Pappu*, *Shehzada* | Anti-Congress coded |
| *Godi media*, *Andhbhakt*, *Urban Naxal* | Both directions, all toxic |
| *Vishwaguru*, *Amrit Kaal* | Government-coded |

Safe, funny, **genuinely neutral** Hindi vocabulary:

| ✅ Use | Meaning |
|---|---|
| **Gyan** | "wisdom" — used sarcastically for unsolicited lecturing (*gyan dena*) |
| **Bhashan** | "speech/oration" — carries a whiff of pomposity |
| **Bakwaas** | "nonsense" |
| **Neta** | "politician" — neutral, universally used |

## 1.6 Name

The name has to do two jobs at once: **sound like an awards body** (deadpan prestige), and **be the thing people actually type**. Four filters:

1. **Deadpan, not jokey.** If the name is already the punchline, the joke is spent before anyone sees a clip. The name should sound *sincere*; the content supplies the irony.
2. **Party-neutral.** No *jumla / feku / pappu / godi / vishwaguru*. See §1.5.
3. **Pronounceable and spellable** by both Hindi and English speakers, first time, over the phone.
4. **Trademark-clear in media classes** (NICE class 38 telecom / 41 entertainment) and domain-obtainable.

### ⚠️ The availability problem — change the *shape* of the name

`pedestal.com` and `pedestal.in` are both taken. So are `laureate.com`, `plinth.com`, `rostrum.com`, `accolade.com` and every other single English dictionary word you will think of. **Every common English word in `.com` has been registered for twenty years.** Hunting for an unclaimed one is not a search problem; it's a dead end.

Three name *shapes* that are still obtainable:

| Shape | Why it works | Examples |
|---|---|---|
| **A. Hindi / Sanskrit words** | Vastly less contested in `.com`, trademark-clean, culturally native to your first market — and distinctive precisely *because* they aren't English | Zomato, Ola, Swiggy, Byju's all went global on Indian-coined names |
| **B. Two-word compounds** | The compound is unclaimed even when both halves are gone | `bhashanboard.com`, `hearhear.com`, `gyanindex.com` |
| **C. Coined words** | Fully ownable, trademark-clean, no SEO competition | any invented spelling |

**For an India-first product, shape A is the strongest answer by a distance.** It is more available, more distinctive to your actual audience, less trademark-crowded, and more memorable than a generic English abstraction. It also localises the joke, which is the point.

**Architecture: one brand + locally-flavoured trophy names.** The brand travels; the trophies localise. India's top tier is **Kohinoor Class**; a UK edition's might be **The Crown**; a US edition's, **The Eagle**.

### Tier 1 — the strongest candidates

| Name | Why it works | Watch out for |
|---|---|---|
| **Bhashan Board** ⭐ **top pick** | *Bhashan* = speech / address / oration in Hindi, with a built-in whiff of pomposity. Paired with "Board" it sounds exactly like a real statutory body — Censor Board, Waqf Board, Khadi Board. *"The Bhashan Board has elevated this statement to Kohinoor Class."* Completely party-neutral, genuinely funny to an Indian ear, perfectly deadpan, and **almost certainly available**. Trademark-clean. | The Bangladeshi island is **Bhasan** Char — different spelling (one `h`), minor search noise only |
| **Hear Hear** ⭐ *(global-first option)* | The parliamentary cry of approval, used in both the Lok Sabha and Westminster. The site solemnly says *"hear, hear!"* to nonsense — deadpan, and it points at **the room applauding** rather than the speaker, which is your sharpest and safest angle (see the Crowd Complicity axis, `02-ranking-system.md` §2.5). Doubling makes it memorable; two quotation marks make the logo. Compound → gettable in `.com`. | Check for audiology brands — no obvious conflict found, but verify. Slight "hearing" misread. |
| **The Gyan Index** ⭐ | *Gyan* = wisdom, used sarcastically in India for unsolicited lecturing. "Index" does the institutional work and describes the product literally. Excellent as the **rating unit name** even if you don't take it as the brand. | Generic-ish; weaker as a standalone consumer brand |

### Tier 2 — strong alternates

**India-first**
| Name | Note |
|---|---|
| **Gyan Sabha** | Echoes Lok Sabha / Rajya Sabha. Institutional, neutral, funny. Small risk of reading as an actual body. |
| **Vachan** | *Utterance* — **and also *promise***. For an archive of political statements that double meaning is close to perfect. Neutral, elegant, short. Mild association with Kannada Vachana poetry. |
| **Sukti** | Sanskrit for "a fine saying / aphorism". Obscure, elegant, near-certainly available. Applied to nonsense it's pure deadpan. |
| **Golden Gyan** | Alliterative, ties the medals to the Indian word. Warmer, less institutional. |
| **Bakwaas Board** | *Bakwaas* = nonsense. Blunter and funnier, but the name becomes the punchline — weaker deadpan. |
| ~~Subhashit~~ | Sanskrit for "well-spoken" — conceptually ideal, but it ends in "-shit" when read in English. Don't. |

**English, gettable shapes**
| Name | Note |
|---|---|
| **Filibuster** | A long, pointless political speech. Instantly understood, political, procedural-sounding — sincere enough to stay deadpan. |
| **The Lectern** | The stand you speak from. Institutional, on-theme, less worn than "podium". Try `thelectern.com`. |
| **Standing O** | Short for standing ovation; ties to the applause theme. `standingo.com`. |
| **The Stump** | Stump speech — and *stumped*. Nice double meaning. |
| **Bully Pulpit** | Classic political phrase, grand and ironic. Long. |
| **The Citation** | An award citation **and** a source citation. Perfect for a site built on sourcing. |
| **On Record** | The Verbatim Doctrine as a name. Journalist-friendly, slightly flat. |

### ⛔ Names to avoid (and why)

| Name | Problem |
|---|---|
| **Ovation** | Ovation LLC has run a US arts TV network under this mark since 1996 — live trademark in exactly your media class. |
| **Claptrap** | Conceptually *ideal* — it literally means "nonsense designed to draw applause" — but it is the mascot character of the **Borderlands** franchise (Gearbox). You would fight its SEO forever and risk a mark tangle in entertainment classes. |
| **Neta-flix** | Netflix. Obviously. |
| **Gyanpeeth / Gyan Ratna** | Parodies the real Jnanpith and Bharat Ratna — real marks, real sensitivity. |
| **Kohinoor** *(as the brand)* | Major Indian consumer brands own it. Keep it as the scarce top **tier** — worth more there. |
| **Uvaacha / Subhashit** | Formulas from the Gita and Sanskrit scripture. The content policy keeps religion out of this project; the brand should too. |
| **Darbar** | Sarcastically apt, but Sikh religious association (Darbar Sahib) plus a major film title. |
| **Bravo / Encore / Vox** | NBCUniversal; Vox Media. Crowded. |
| **Sansad / Lok Sabha** derivatives | Impersonating an actual institution. Never. |

### Recommendation

| Slot | Pick |
|---|---|
| **Brand** | **Bhashan Board** — `bhashanboard.com` + `bhashan.in` |
| **The jury** | **The Committee** |
| **Rating unit** | **Gyan Points (GP)** |
| **Duel mechanic** | ***Aamne-Saamne*** ("face to face") |
| **Annual event** | **The Honours List** |
| **Global fallback** | **Hear Hear**, then **Filibuster** |

Going Indian is not a retreat from the global ambition — it's the same move Zomato and Ola made, and it buys you availability, trademark clearance and distinctiveness in one decision. Your only market for the next six months is India anyway.

### The decision test

Say each finalist out loud in these three sentences. The right name survives all three:

1. *"It's ranked #4 on **____**."* — does it sound like a real ranking authority?
2. *"**____** has awarded this statement Kohinoor Class."* — does the deadpan land?
3. Spell it over the phone to someone who has never heard it. Do they get it first try?

### Checking availability — 30 seconds

- **Domains:** [instantdomainsearch.com](https://instantdomainsearch.com) or [tld-list.com](https://tld-list.com) — results as you type, across every TLD at once. Buy `.com` and `.in` together; add `.tv` if `.com` is gone.
- **Trademark:** [tmrsearch.ipindia.gov.in](https://tmrsearch.ipindia.gov.in/tmrpublicsearch/tmsearch.aspx) — free, no login. Run **wordmark *and* phonetic** search, **classes 38 and 41**. Then USPTO/EUIPO if global matters.
- **Handles:** [namechk.com](https://namechk.com) — X, Instagram, YouTube, Reddit in one pass. **A name with no available handles is not an available name.** Grab them the same day you buy the domain.
- **Registrar and host outside India** — resilience, not evasion (`04-legal-and-safety.md` §4.4). You still comply fully with lawful orders.

> If the `.com` for your favourite is gone, check the **compound** before giving up: `bhashanboard.com`, `thegyanindex.com`, `hearhear.tv`. The compound is usually free even when the root is not.

## 1.7 What the site actually is, in one diagram

```
        ┌──────────────────────────────────────────┐
        │  VERBATIM LAYER  (never touched)         │
        │  embedded clip · transcript · source ·   │
        │  date · venue · surrounding context      │
        └──────────────────────────────────────────┘
                          ▲
                          │  strictly separated
                          ▼
        ┌──────────────────────────────────────────┐
        │  JUDGMENT LAYER  (crowd-owned)           │
        │  pairwise duels · Elo rating · axes      │
        └──────────────────────────────────────────┘
                          ▲
                          ▼
        ┌──────────────────────────────────────────┐
        │  SARCASM LAYER  (ours, and only ours)    │
        │  tiers · medals · trophy cabinet ·       │
        │  honorifics · ceremony · copy            │
        └──────────────────────────────────────────┘
```

Keep these three layers separated in the product, in the database, and in your head. Every legal question you will ever face reduces to *"which layer is this in?"*
