# 05 — Distribution, Growth & Money

> **Current scoring note (July 2026).** References in this design document to pairwise duels, Elo, weighted memberships, seed placements, or internal placement votes are historical. The implemented authority is `/rules`: after qualifying playback, each verified account may enter one immutable ruling per statement; every ruling has equal weight and performance is their arithmetic mean. There is no editorial prior. Aamne-Saamne is a non-scoring exhibition.

## 5.1 The core insight: you are a meme factory that happens to own a website

Nobody discovers a ranking site by searching for one. They see a clip on Reels, laugh, notice a gold-foil watermark that says **#4 GLOBALLY · KOHINOOR CLASS**, and think *"…wait, there's a ranking for this?"*

So the product must **manufacture its own distribution automatically**. Every clip, at publication, generates:

1. **Vertical video export (9:16)** — the clip, burned-in English subtitles, tier medal in the corner, rank badge, site watermark. Auto-queued for Reels / Shorts / TikTok.
2. **OG share card** — for WhatsApp, X, LinkedIn previews. The quote in serif type, the medal, the GP score, the rank. This is your highest-leverage single asset: **in India, WhatsApp forwards are the distribution layer**, and a WhatsApp forward is just an OG card.
3. **Static quote card (1:1 and 4:5)** — for Instagram feed and stories.

None of these should require a human. Publication triggers rendering. If a clip goes viral and someone had to manually make the asset, you already lost the window.

### The share loop

```
  clip published ──▶ auto-generated assets ──▶ posted to social
        ▲                                              │
        │                                              ▼
   new clip submitted ◀── user joins & contributes ◀── watermark drives
                                                       traffic to site
```

Every step must be automatic except "user contributes."

## 5.2 Recurring formats (the content calendar builds itself)

Ranking systems generate content for free. Ship these as scheduled, automatic products:

| Cadence | Format | Why it works |
|---|---|---|
| **Daily** | *"Today in Placement"* — new entries currently being ranked | Creates daily-return habit |
| **Weekly (Sun)** | **The Weekly Gyan** — top 5 climbers, new entries, biggest falls, one Kohinoor candidate. Newsletter + YouTube video + Reel. | Your anchor product. Predictable, shareable, subscribable. |
| **Monthly** | **Neutrality Audit** + **Vote Integrity Report** | Trust-building; reliably picked up by media |
| **Quarterly** | *Rookie of the Quarter*, *Rising Star*, state-ladder recaps | Regional press hooks |
| **Annual** | **THE STANDING OVATIONS** — the awards show | The big one. See below. |

### The Standing Ovations (annual)

A full, straight-faced awards ceremony. Live-streamed, or a produced video, or at minimum a beautifully designed results page.

- Categories: Statement of the Year · Newcomer of the Year · Consistency Award · The Standing Ovation (loudest applause for the worst claim) · Hall of Fame inductions
- Public voting rounds in the weeks before — enormous engagement spike
- Golden envelopes, orchestral music, an acceptance-speech slot nobody will use, an empty chair on stage
- **Right of reply extended to every nominee**, publicly and in advance — this is both genuinely fair and extremely funny

This is your annual press moment. Plan the first one for ~12 months post-launch. It is the thing that turns a website into a brand.

## 5.3 SEO and the durable-traffic layer

Ranking data is exceptionally good for search — it produces thousands of legitimately distinct, genuinely useful pages:

- `/neta/<politician-slug>` — profile, career arc, trophy cabinet
- `/statement/<slug>` — clip, full transcript, translations, context, sources
- `/leaderboard/<geo|party|category|period>`
- `/compare/<politician-a>-vs-<politician-b>` — head-to-head, huge long-tail search volume
- `/hall-of-fame`

**Full transcripts are your SEO engine.** People search the exact phrase they half-remember. If your page has the verbatim text, the date, the venue, and the source link, you win that query — and it also happens to be the thing journalists need. Index transcripts in all languages plus English translation.

Publish structured data (`VideoObject`, `Person`, `Quotation`) so the pages surface well.

## 5.4 Monetisation

### Be realistic about advertising

Political content sits awkwardly with programmatic ad networks. Google's **Sensitive Events** policy (added to AdSense in Feb 2024) restricts monetisation around politically-charged events, and enforcement is unpredictable and unappealable. Election periods — your highest-traffic windows — are exactly when demonetisation risk peaks.

**Plan for ads to be, at best, a bonus.** Never build the model on them.

### The realistic stack

**1. Merchandise — quotes, never faces**

Typographic prints, tees, mugs, stickers, posters carrying **the quote in elegant serif** with the tier medal and rank. Never the politician's face — that's the commercial-exploitation fact pattern that personality-rights suits actually win on (see `04-legal-and-safety.md` §4.1).

This is a *feature*, not a compromise: a beautifully typeset absurd quote on a wall poster is funnier and more giftable than a printed face.

A "Kohinoor Class" certificate print — gold foil, wax seal, serial-numbered, framed — is an outstanding product.

**2. Diamond Membership (the obvious sarcastic subscription)**

Tiered, priced for India (₹99 / ₹299 / ₹999 per year), named ridiculously:

| Tier | Perks |
|---|---|
| 🥈 **Silver Patron** | Ad-free · profile flair · early access to new entries |
| 💎 **Diamond Patron** | The above + 1.5× vote weight¹ · custom flair · duel history & personal stats · monthly digest |
| 👑 **Kohinoor Circle** | The above + name engraved on the public Patrons page · vote in the Standing Ovations jury · annual physical certificate |

¹ Paid vote weight is a real integrity trade-off. Cap it low (1.5× maximum), disclose it publicly, and exclude paid weight from placement matches. If it ever looks purchasable, kill it — leaderboard credibility is the entire asset.

Copy: *"Diamond Membership. Because merit should be purchasable. It is, after all, a site about politics."*

**3. Direct support** — UPI, Razorpay, Buy Me a Coffee. India responds well to a straightforward, funny ask. *"This site is funded by people who are also disappointed."*

**4. Data & API licensing (the sleeper — and possibly the real business)**

Strip the sarcasm layer and what you have built is:

> A structured, sourced, timestamped, transcribed, translated, cross-referenced corpus of public statements by Indian elected representatives — with community judgment signals attached.

That does not currently exist in accessible form. Buyers:
- Newsrooms and fact-checking desks (research and archive)
- Political-science and media researchers
- Election-monitoring organisations
- Documentary and media production

Free tier for academics and journalists (goodwill + citations + credibility), paid tier for commercial use. This may end up worth more than the consumer site, and it costs nothing extra — it's the same database.

**5. Sponsorship / grants** — press-freedom and civic-tech funders exist, but be careful: foreign funding of anything politics-adjacent in India carries **FCRA** complications. Talk to a lawyer before accepting any cross-border grant.

## 5.5 Launch sequencing (India, first 3 weeks)

**Week 0 — dark.** 300+ seeded clips, 20 built profiles, internal duels run so the ladder is spread. All legal pages live. Kill-switch tested.

**Week 1 — soft launch.**
- Seed to: r/india, r/IndiaSpeaks, r/librandu, r/indiadiscussion (**post to left- and right-leaning subs simultaneously** — this is a deliberate neutrality signal and it works), r/unitedstatesofindia
- X: contact political-satire and data-journalism accounts, not partisan accounts
- **Lead with the mechanic, not the politics.** *"We built an Elo ranking system for political statements"* travels far further and picks far fewer fights than *"look at this foolish politician."* Hacker News and data-nerd audiences will engage with the first framing and ignore the second.

**Week 2 — the duel loop.**
- Push *Aamne-Saamne* hard; it's the retention mechanic
- First contributor cohort recruited; publish the contributor leaderboard
- First state ladders (UP, Bihar, Maharashtra, TN) once volume allows

**Week 3 — first Weekly Gyan + press.**
- Ship the recap video and newsletter
- Publish the **first Neutrality Audit** with real numbers — this is your press hook and your inoculation against the "you're partisan" attack that is definitely coming
- Pitch to tech and media reporters on the *mechanic* angle: "Elo ratings for political statements"

## 5.6 Global expansion (Phase 3)

Sequence by **legal risk × content abundance × language**:

| Priority | Country | Rationale |
|---|---|---|
| 1 | 🇺🇸 USA | *NYT v. Sullivan* actual-malice standard is the most speech-protective regime on earth for exactly this product; endless content; English |
| 2 | 🇬🇧 UK | Rich satire tradition; English; libel law is stricter than the US — verbatim doctrine matters even more |
| 3 | 🇦🇺 🇨🇦 | English, low risk, modest volume |
| 4 | 🇵🇭 🇧🇷 🇳🇬 🇿🇦 | High engagement, strong meme cultures, moderate risk |
| ⚠️ | 🇵🇰 🇧🇩 🇱🇰 | Huge Indian-audience interest and obvious appeal — **but India–Pakistan content will destroy your neutrality positioning and attract nationalist brigading from both directions.** If you do it, launch them as fully independent national ladders with no cross-country duels, and expect to spend real moderation effort. |

**Do not open a country before you can seed it to ~200 clips.** A country tab with 9 entries makes the whole site look abandoned. Better to run India-only for six months than to have eight empty leaderboards.

**Highest-value global feature, once volume allows:** cross-country duels. *"Aamne-Saamne: 🇮🇳 India vs 🇺🇸 USA."* Internationally shareable, endlessly re-postable, and the single best answer to "why would an American care about this site."
