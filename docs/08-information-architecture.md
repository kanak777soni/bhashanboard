# 08 — Information Architecture & Page Design

## 8.1 Single-page or multi-page? — **Multi-page. Not close.**

You asked because you weren't sure. Here is the reasoning, because the *why* matters more than the answer.

A single-page app is right when a product has **one job and one screen** — a calculator, a dashboard, a chat interface. It is wrong when the product is **an archive of thousands of distinct things people need to link to**. That is exactly what you are building.

Four reasons, in order of weight:

**1. SEO is a primary growth channel, and an SPA forfeits it.**
Your durable traffic comes from people searching a half-remembered quote. Full transcripts on individually indexable URLs win those searches. One URL wins nothing. This alone settles it.

**2. WhatsApp is your distribution layer, and WhatsApp shares URLs.**
`05-growth-and-money.md` §5.1 makes the auto-generated OG share card your main growth loop. **An OG card requires a unique URL with its own server-rendered meta tags.** Every statement must be its own page or the growth loop cannot exist.

**3. Your content model is inherently multi-entity.**
Statements, politicians, parties, states, leaderboards, categories, comparisons. Roughly 5,000+ meaningful pages within a year. That's a document site.

**4. Citation.** Journalists and researchers must be able to link to *one statement*. That's the credibility play — and it needs a permalink.

### But one screen should feel like an app

> **The architecture: a document site with one arcade machine inside it.**

| Surface | Model | Feel |
|---|---|---|
| Standings, statements, profiles, ledger | **Server-rendered documents.** Fast, indexable, linkable, works without JS | Newspaper / almanack |
| **The Duel** (`/duel`) | **Client app.** Full-bleed, keyboard-driven, no chrome, prefetched queue | Arcade game |

This split is the whole answer. Don't SPA the archive to make the duel feel good, and don't make the duel a page reload to keep the archive simple.

## 8.2 Routes

```
/                          The Standings — homepage, no hero
/duel                      Aamne-Saamne — the arcade
/statement/<slug>          One statement — the certificate
/neta/<slug>               Politician stat sheet
/party/<slug>              Party ladder
/standings/<scope>         india · global · state/up · party/<x> · category/<x> · <period>
/compare/<a>-vs-<b>        Head-to-head
/hall                      Hall of Fame
/ledger                    Corrections, takedowns, neutrality & integrity audits
/rules                     The Rules of the Committee + the rating rubric
/committee                 Who we are, how ratings work, right of reply
/submit                    Submit a statement
```

Phase 1 ships `/`, `/statement`, `/neta`, `/standings`, `/duel`, `/rules`, `/ledger`, `/submit`. The rest is Phase 2.

## 8.3 The pages

Each page gets **one distinctive idea**. A site where every page is the same grid of cards is the thing we're avoiding.

---

### `/` — The Standings
**Idea: you land inside live data. There is no hero.**

```
┌─ MASTHEAD ────────────────────────────────────────────────────┐
│ THE BHASHAN BOARD                                             │
│ An archive of public wisdom. Independently ranked.            │
│ EDITION CDXVII · 26 JULY 2026 · 1,847 ENTRIES ON RECORD       │
├───────────────────────────────────────────────────────────────┤
│ PARITY ▓▓▓▓▓▓▓▓░░ BJP 31 · INC 29 · REGIONAL 33 · OTHER 7     │
├───────────────────────────────────────────────────────────────┤
│ ⏱ IN PLACEMENT — 3 statements are currently being ranked ▸    │
└───────────────────────────────────────────────────────────────┘

┌── THE STANDINGS ─────────────────────────┬── RAIL ───────────┐
│  #   ±    ENTRY                  GP  TIER│ NOW IN PLACEMENT  │
│ ─────────────────────────────────────────│ ─────────────────  │
│  1   —   "Cloud cover blocks…" 1947  👑  │ 12/20 · proj. 💎  │
│  2  ▲2   "Genes of the…"       1921  👑  │                   │
│  3  ▼1   "Potato factory"      1918  👑  │ LATEST RULING     │
│  4  ▲7   "Nobody knows what…"  1890  💎  │ ─────────────────  │
│  5  —    "Radar and clouds…"   1871  💎  │ Kohinoor Class    │
│                                          │ conferred 2h ago  │
│  [ ⚔ ENTER THE DUEL ]                    │                   │
└──────────────────────────────────────────┴───────────────────┘
```

- Zebra striping via `--paper-deep`, hairline rules, tabular figures.
- A live **ticker strip** for in-placement entries — the only moving thing on the page, and it earns it.
- The duel CTA sits *inside* the table, not in a hero.
- Asymmetric grid: table spans 8 columns, rail 3, margin 1.

---

### `/statement/<slug>` — The Certificate
**Idea: the statement is presented as an official award document.**

The signature page of the site. Structure top to bottom:

1. **The certificate frame** — guilloché border, `ENTRY No. 00417`, wax seal, *"Ratified by the Committee on 12 March 2026"*. The clip embed sits inside the frame.
2. **The verdict block** — tier medal, GP, global/national/party rank, movement chip. Ruled, tabular.
3. **The context scrubber** — a thin timeline showing 60s before and after, indexed portion highlighted in vermilion. Caption: *"The context does not help."*
4. **Parallel-text transcript** — original script left, English right, line-numbered, facing-page. Devanagari at `line-height: 1.8`.
5. **Provenance** — source stamps (`TIER A · SANSAD TV`), date, venue, submitter credit.
6. **Right of reply** — if used, pinned *above* the verdict, styled as a printed erratum insert.
7. **Judgment axes** — five bars, hairline, no gradients.

---

### `/neta/<slug>` — The Stat Sheet
**Idea: Wisden, not Wikipedia. A passport photo, then numbers.**

Small passport-style portrait — deliberately *not* a hero image. Then a dense ruled stat block: career GP, peak rating, entries indexed, global/national/party rank, consistency.

- **Career arc** — thin ink sparkline, no fill, no gradient, no rounded caps
- **Form guide** — last five tiers as medal glyphs in a row
- **Trophy cabinet** — engraved medals with counts
- **Honorifics** — in real small caps, listed as *conferred titles* with the date conferred
- **Right of reply status** — always visible, even when unused: *"Office has not responded."*
- **Compare** button → `/compare/...`

---

### `/duel` — The Arcade
**Idea: the only screen with no masthead, no rules, no cream. Black, full-bleed, keyboard-first.**

```
┌───────────────────────────┬───────────────────────────┐
│                           │                           │
│      [ clip A ]           │      [ clip B ]           │
│                           │                           │
│   quote, neta, date       │   quote, neta, date       │
│                           │                           │
│        [ ← ]              │        [ → ]              │
└───────────────────────────┴───────────────────────────┘
        WHICH IS MORE MAGNIFICENT?
        SESSION: 23 DUELS · ⌨ ← → TO CHOOSE · SPACE TO PLAY
```

- **Keyboard-driven**: `←` `→` choose, `Space` plays both, `S` skips. Prefetch the next pair while the current one is on screen — zero perceived latency is what makes it addictive.
- **The stamp** fires on selection — see `07-design-language.md` §7.7.
- **Cross-party pairing** surfaced explicitly: *"BJP vs INC — you decide."*
- Optional one-tap axis tag after voting; never blocks the next duel.
- Mobile: panels stack vertically, tap to choose, swipe up to skip.

**In Phase A this is admin-only** and can be visually crude — same layout, no polish. See `02-ranking-system.md` §2.0.

---

### `/ledger` — The Ledger
**Idea: an actual accounting ledger. Ruled columns, running entries, no design flourish at all.**

Every correction, removal, takedown notice, neutrality audit and vote-integrity report, in one chronological ruled table. The deadpan is total — it looks like a bookkeeping page because it is one.

> *"We keep score of ourselves."*

This page is a credibility asset out of all proportion to its build cost, and it doubles as your transparency-report obligation (`04-legal-and-safety.md` §4.5).

---

### `/compare/<a>-vs-<b>` — Head to Head
Two stat sheets side by side, shared axes, hairline divider down the centre. Enormous share value, big long-tail SEO. Auto-generate an OG card for every comparison.

---

### `/rules` · `/committee` · `/submit`
Set as **printed documents**: numbered clauses, wide margins, marginalia, footnotes. Gazette-notification register. `/rules` carries both the Rules of the Committee and the **published rating rubric** — which is load-bearing legally, not decorative (`04-legal-and-safety.md` §4.2).

## 8.4 Navigation

No hamburger, no sticky translucent blur bar. A **thin ruled nav directly under the masthead**, all-caps Archivo, letterspaced:

```
STANDINGS · DUEL · NETAS · HALL OF FAME · LEDGER · RULES · SUBMIT
```

Sticky only on scroll-up, and it collapses to a single hairline rule with the section name — a newspaper running head, not an app bar.

## 8.5 Mobile — most of your traffic

India is mobile-first, mid-range Android, patchy networks. **The dense design must survive 360px**, and airy-ing it up on mobile would surrender the entire visual thesis.

| Element | Mobile treatment |
|---|---|
| Standings table | Stays a table. Drop the quote column, keep rank/movement/medal/GP. **Do not convert to cards.** Horizontal scroll on the inner table is fine — scoreboards do this. |
| Certificate frame | Guilloché simplifies to a 2px foil rule; seal and serial number stay |
| Parallel transcript | Stacks — original then translation, with a sticky language toggle |
| Duel | Panels stack vertically; tap to choose; swipe up to skip |
| Nav | Horizontal scrolling rule of links, not a hamburger |
| Type | Scale down display sizes ~25%; **never reduce typographic contrast** |

## 8.6 Performance — the constraint that will actually hurt

**The killer: YouTube iframes are ~700KB each.** A standings page with 20 embeds is 14MB and unusable on an Indian 4G connection.

**Use the facade pattern, everywhere, no exceptions.** Render a poster image plus a play glyph; load the real iframe only on click. Cuts initial payload by ~95% and is the single highest-impact performance decision on the site.

Budget:

| Metric | Target |
|---|---|
| HTML + CSS + fonts, homepage | < 120 KB |
| JS on document pages | < 40 KB (duel page may be larger) |
| LCP on mid-range Android, 4G | < 2.0s |
| Embeds loaded on page load | **0** |

Also: never autoplay (data costs money to your users), self-host fonts with `font-display: swap`, serve posters as AVIF/WebP, and lazy-load below-fold images. Test on a real ₹12,000 Android phone on throttled 4G — not on a laptop.

## 8.7 Build order

1. **Design tokens** — colour, type scale, rules, spacing. Before any component. Every "looks AI-generated" bug traces back to a component inventing its own values.
2. **Masthead + Standings table** — the homepage is the thesis; if it lands, everything else follows.
3. **Certificate frame + statement page** — the second signature screen.
4. **Admin duel** — crude is fine, it's internal in Phase A.
5. **Stat sheet.**
6. **OG card renderer** — before launch, not after. Growth depends on it.
7. **Ledger, rules, submit.**

## 8.8 Before you build anything

**Design two screens in a design tool first — the homepage and the statement page.** Get those two right and the rest of the site is assembly. Trying to discover the visual language while writing components is how sites drift back toward the template look.

If it helps, I can build a **static HTML prototype** of the homepage and statement page — real type, real guilloché, real medals, dummy data — so you can look at it and react before any real code gets written. That is much cheaper than discovering in week three that the direction is wrong.
