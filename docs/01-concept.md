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

You need a name that (a) is deadpan not jokey, (b) is party-neutral, (c) has a path to global.

**Recommended architecture: a globally-portable brand + locally-flavoured award names.**

The site brand travels. The trophies localise. India's top tier is **Kohinoor Class**; the UK edition's might be **The Crown**; the US edition's, **The Eagle**. This gives you a single brand with infinite local texture.

### Brand candidates

| Name | Read | Global? | Notes |
|---|---|---|---|
| **Ovation** | Deadpan, prestigious, ironic | ✅ Excellent | *"ovation.tv"* / *"getovation.com"*. Strong recommendation. |
| **The Podium** | Institutional, neutral | ✅ Excellent | Slightly generic |
| **Standing Ovation** | Same joke, longer | ✅ Good | Great for the annual awards show |
| **Bhashan Board** | Sounds like a statutory body — perfect deadpan | ❌ India-only | Excellent India sub-brand |
| **The Gyan Index** | Institutional + Indian | ⚠️ Partial | Great as the *rating* name |
| **Neta-flix** | Funny | ❌ | **Trademark lawsuit magnet — do not** |
| **Gyanpeeth** | Parodies the Jnanpith Award | ❌ | Trademark risk against a real award — avoid |

**My recommendation:**
- **Brand:** *Ovation*
- **India edition:** *Ovation India — The Bhashan Board*
- **Rating unit:** *Gyan Points (GP)*
- **Duel mechanic:** *Aamne-Saamne* ("face to face")
- **Annual event:** *The Standing Ovations*

Register the .com and the .in together. Use a registrar and host outside India (see `04-legal-and-safety.md` — this is about resilience, not evasion; you still comply fully).

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
