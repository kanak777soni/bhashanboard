# 04 — Legal, Compliance & Safety (India)

> **Current scoring note (July 2026).** References in this design document to pairwise duels, Elo, weighted memberships, seed placements, or internal placement votes are historical. The implemented authority is `/rules`: after qualifying playback, each verified account may enter one immutable ruling per statement; every ruling has equal weight and performance is their arithmetic mean. There is no editorial prior. Aamne-Saamne is a non-scoring exhibition.

> **Not legal advice.** This is research-grounded product guidance to make your conversation with an Indian media/tech lawyer short and cheap. Retain one before public launch — budget for it in Phase 1, not Phase 3.

## 4.1 Your direct question: can we use real names and real images?

**Names: yes.** **Images and video: yes, with a specific method.** You do not need pseudonyms or cartoon avatars — and using them would actually make the product *worse and less defensible*, because a caricature is a statement you authored, while a verbatim clip is a fact you cited.

Here's the reasoning, broken into the three distinct legal questions people usually mash together.

### (a) Using their name — personality / publicity rights

The Delhi High Court has been explicit that using a public figure's name or image for **commentary, satire, parody, criticism or news reporting is permissible** as an exercise of Article 19(1)(a) free speech, and does not infringe the right of publicity. The court has specifically invoked R.K. Laxman's cartoons and noted that political leaders have always been subject to satire and criticism. In the recent Raghav Chadha personality-rights matter, the court observed that criticism of political decisions does not automatically infringe personality rights.

The Indian personality-rights cases that *succeed* — Anil Kapoor, Jackie Shroff, Aishwarya Rai — are celebrities stopping **commercial exploitation** of their likeness (merchandise, AI deepfakes, endorsement implications). That is a different thing from political commentary.

**What this means for you:**
- ✅ Real names, real photos, real clips, in the archive and on profile cards
- ❌ **Their face on merchandise** — this is the exploitation fact pattern. Sell typography of the *quote*, never the face. (Conveniently, quote merch is more meme-able anyway.)
- ❌ Anything implying endorsement or association
- ❌ AI-generated likeness of any kind — this is the exact fact pattern currently winning in Indian courts

### (b) Using their words — defamation (BNS §356)

Criminal defamation survived the new criminal code as **BNS §356**. Two exceptions carry you:

- **Exception 1 — truth for public good.** Note carefully: in Indian criminal defamation, *truth alone is not enough* — it must also be **for the public good**. Your public-interest case is strong and should be stated explicitly on the site: an accessible, sourced record of what elected representatives assert in public is squarely in the public interest.
- **Public conduct of public servants.** Good-faith opinion on the conduct of a public servant discharging public functions is protected. Every clip you publish is exactly this.

**This is why the Verbatim Doctrine is a legal instrument, not just an aesthetic.** If you publish *"X said the following"* + unedited clip + source + timestamp, the imputation is true by construction. If you publish *"X is an idiot,"* you have made your own assertion and must defend it.

**Practical rules that fall out of this:**
- Titles and descriptions state **what was claimed**, never a verdict about the person
- Tier names attach to **the statement**, never to the human ("this statement is Kohinoor Class", not "this politician is stupid")
- Never assert motive or mental state — no "he lied", "she knows this is false", "deliberately misled"
- Never assert an unproven fact about them (corruption, criminality, private conduct). **Scope is public statements only.**
- The Committee's commentary is clearly **opinion on a published statement**, in the sarcasm layer, visually distinct from the verbatim layer

### (c) Using their footage — copyright

This is the real constraint, and it's a copyright question, not a personality question.

- **Parliamentary proceedings** are public-domain material, **but Prasar Bharati asserts copyright in the broadcast signal** and has issued YouTube strikes to news channels and journalists over Parliament clips. Do not assume Sansad TV footage is free to re-host.
- **Fair dealing, §52(1)(a)(ii)** of the Copyright Act covers *criticism or review*. Short excerpts, transformative context, substantial added commentary and ranking — a genuinely reasonable position for a criticism-and-review site. But fair dealing is a defence you raise *after* being sued, not a shield that prevents the suit.
- **§52(1)(q)** permits reproduction of matter published in official gazettes and reports of legislature proceedings — helpful for **transcripts**, and a good reason to lean on text.

**The lowest-risk engineering default is to embed, not re-host.** Full detail is
in `03-content-pipeline.md` §3.1. If YouTube serves the bytes, the rights-holder
keeps their monetisation and takedown lever. Cloudinary is a narrow exception
for short evidence excerpts the project owns, has permission to host, or has a
documented lawful archival basis for retaining. Storage and transcoding
technology do not create permission, so every hosted asset still needs
provenance and a working takedown path. The administrator workflow therefore
requires an explicit rights and provenance attestation before it issues
short-lived signed upload parameters. The original remains an authenticated
Cloudinary asset; only a server-verified H.264/AAC derivative can proceed to
full playback approval and statement attachment, and playback uses signed
delivery URLs rather than a public unsigned asset.

## 4.2 The trap in your original idea: publisher vs. intermediary

This is the most important legal insight in this document, and it is not obvious.

**§79 of the IT Act** gives platforms safe harbour for user content — but only for *intermediaries* that do not initiate, select, or modify the information. And Part III of the IT Rules 2021 explicitly treats **"online curated content"** providers as **publishers**, not intermediaries.

> **A site whose entire product is editorially selecting and ranking political clips is, on its face, a publisher.** You would carry full liability for every single clip.

That is a very different — and much worse — risk profile than being a platform.

### The fix: make ranking a *published function of public votes*, not an editorial act

Restructure so that the judgment is demonstrably the community's, not yours:

1. **Users submit** the clips. You verify facts (source, date, speaker, policy) — you do not select for "foolishness."
2. **Users rank** them, via duels. You compute Elo. **Publish the algorithm.** An Elo formula is mechanical and auditable — that's the point.
3. **Your editorial act is narrowed to policy enforcement:** is the source real, is it in scope, does it violate the Rules of the Committee. That is *moderation*, which the rules expect of intermediaries.
4. **Say it everywhere, in the deadpan voice:** *"The Committee does not rank statements. The public does. The Committee merely counts, and keeps the trophies polished."*

You will not be a pure intermediary — you're curating a topic — but this materially strengthens the position, and it happens to make the product genuinely better anyway. Get a lawyer to pressure-test the specific structure.

### ⚠️ Consequence of internal-first rating

The plan is to rate internally at launch and open public voting later (`02-ranking-system.md` §2.0). That's the right product call — but be clear-eyed about what it costs you here:

> **During Phase A you are unambiguously the publisher of the judgment.** There is no "the crowd said it" available to you. Every tier, every medal, every ranking is your editorial act.

This doesn't make it unworkable — plenty of publications rank things — but it does mean **the Verbatim Doctrine is now your only structural defence**, and it has to be airtight. Four mitigations, all cheap:

1. **Publish the rating rubric.** A written, public set of criteria converts *"we decided this was foolish"* into *"this scored high on Logic Damage under published criteria."* Transparent criteria are enormously more defensible than undisclosed editorial taste — and it costs you one page.
2. **The tier attaches to the statement, never the person.** Enforce this in copy review, not just policy. *"This statement is Kohinoor Class"* — never *"this politician is Kohinoor Class."*
3. **Lawyer before launch, not after.** Internal rating raises the stakes on day one. Move the legal review earlier in the roadmap.
4. **Treat Phase B/C as risk transfer, not just growth.** Every point of weight that moves from the Committee to the public ballot weakens the "you authored this judgment" argument. Don't let Phase A drift on for a year because it's comfortable.

Phase B's advisory ballot is useful here too: once public ballots are displayed alongside Committee rulings, you are visibly reporting an independent public judgment even before it carries weight.

### Corollary: never auto-publish

Automated LLM triage that publishes without a human gate is the worst of both worlds — you get publisher liability *and* you can't explain your own decisions. The human gate stays. Non-negotiable.

## 4.3 IT Amendment Rules 2026 — what changed, and why you're mostly fine

The IT (Intermediary Guidelines and Digital Media Ethics Code) **Amendment Rules, 2026** were notified 10 February 2026 and took effect **20 February 2026**. Key changes:

| Change | Impact on you |
|---|---|
| **"Synthetically Generated Information" (SGI)** defined and regulated — mandatory disclaimers + permanent provenance metadata | **You are out of scope** — you publish nothing synthetic. Turn this into a badge. |
| Platforms must make users **declare** whether uploads are synthetic, and **verify that declaration** through an automated process | Applies to your submission form. Add the declaration checkbox + an automated SGI-detection check on submitted sources. |
| **Takedown window cut from 36 hours to ~3 hours** for court orders / authorised government notices | **This is your biggest operational burden.** See §4.5. |
| Missing the 3-hour window → **immediate loss of safe harbour** | You need a 24/7 rota or an automated kill-switch from day one |

### Turn the SGI rule into brand

> **🏅 Certified Organic Gyan**
> *Every entry in this archive is unedited human speech from a public source. No synthetic content is permitted. No AI was harmed in the making of this wisdom.*

Put this badge on every clip page and make it a filter. In an era where every political video is suspect, **"we never touch the footage" becomes your credibility moat** — and it's exactly what makes journalists willing to cite you.

## 4.4 The March 2026 crackdown — read this carefully

In March 2026 the Indian government:
- Had Instagram remove comedian **Pulkit Mani's satirical Modi impersonation reel** (16.5M views) via a **§79(3)(b)** notice, on 18 March 2026
- Ordered **dozens of parody/satire accounts withheld on X** under **§69A** starting the same day — including @Nehr_who, @DrNimoYadav, @DuckKiBaat, @mrjethwani
- Ran a broader pattern of takedowns against animated cartoons, satirical music videos and AI-generated posts targeting the PM

Civil society argues these orders fail the *Shreya Singhal* (2015) requirements for reasoned, challengeable blocking orders with a prior hearing. That argument may eventually win. It will not protect you next Tuesday.

**Read the pattern, not the panic.** What was hit: **impersonation, AI-generated likeness, and content targeting one individual at the top.** What was not hit: verbatim archives, news clips, balanced criticism.

This is precisely why the plan is built the way it is:

| Risk factor in the crackdown | How this design avoids it |
|---|---|
| Impersonation / performing as the politician | Verbatim only. Never re-enact, never impersonate. |
| AI-generated or manipulated likeness | Hard ban, enforced at submission, badged publicly |
| Single-target focus on the PM | Party parity enforced in the queue and published on the homepage |
| Dependence on a social media account | **Own your domain.** Social accounts are distribution, never the product. |
| No takedown process | Published grievance officer, SOP, and a 3-hour kill-switch |

**Structural resilience — build these before you need them:**
- Own the **.com and .in**; use a registrar and host outside India. (This is resilience, not evasion — you still comply fully with lawful orders. It just means one order doesn't erase the archive.)
- **Never** let a social account become the canonical archive. Instagram/X/YouTube are megaphones; the site is the record.
- **Nightly encrypted exports** of the database (clips, transcripts, ratings, sources) to storage in a second jurisdiction.
- Publish a **transparency report** listing every takedown notice, order and removal, with dates. It's a credibility asset, it's press, and it is the deadpan bit written by reality itself.

## 4.5 Compliance checklist — ship these on day one

**Cheap to build now; expensive to retrofit under a 3-hour clock.**

- [ ] **Grievance Officer** — named, India-resident, contact published on-site. Acknowledge complaints within 24h, resolve within 15 days.
- [ ] **Takedown SOP + kill-switch.** One admin action must instantly unpublish any clip, globally, and log it. **Test that the whole path — inbox → verify → unpublish → log — runs in under 3 hours at 2am.** Rota, pager, escalation.
- [ ] **Terms of Service** + **Content Policy** (the Rules of the Committee) + **Privacy Policy**
- [ ] **DPDP Act 2023** compliance for user accounts — consent notice, purpose limitation, deletion on request, breach notification
- [ ] **SGI declaration** on the submission form + automated verification check
- [ ] **Right of Reply** mechanism, verified and published (see §4.6)
- [ ] **Correction Ledger** — public log of every removal, correction and re-contextualisation
- [ ] **Notice-and-action page** — a clean, obvious path for anyone to report a clip
- [ ] **Election / MCC mode** — see §4.7
- [ ] **Immutable audit log** of every moderation decision, with reviewer identity and reason

**Stay below the 50-lakh-user (5M) Significant Social Media Intermediary threshold** for as long as you can. Above it you inherit Chief Compliance Officer, Nodal Contact Person, Resident Grievance Officer, monthly compliance reports and traceability obligations. Plan for it as a milestone with a lawyer attached, not a surprise.

## 4.6 Right of Reply — your best defensive feature, and it's funny

Every politician profile and every clip page carries a **Reply** button. If their verified office responds, the response is **pinned, permanent, unedited, and at least as prominent as the clip.**

Why this is disproportionately valuable:

- **Legally**: it is powerful evidence of good faith and of a genuine public-interest purpose — directly relevant to the BNS §356 "public good" limb
- **Practically**: a politician with a working public channel to respond is far less likely to reach for an FIR
- **Editorially**: it is real journalism practice and it is what makes newsrooms comfortable citing you
- **Comedically**: it is the funniest possible feature, played straight —

  > *"The Hon'ble Member's office has responded to this entry. We have pinned their response above the clip, unedited, because we are aggressively fair. Their rating remains unchanged, because so does the video."*

Almost nobody in this space does it. It costs you a form and a review step, and it buys you enormous credibility.

## 4.7 Elections mode

Section 126 of the Representation of the People Act 1951 imposes a **48-hour silence period** before polling, and since 2019 ECI guidelines extend campaign restrictions to social media. During the 2026 general and bye-elections the ECI reiterated that all stakeholders must comply with the IT Act, IT Rules and the Model Code of Conduct — and directed that misleading or unlawful AI-generated content be acted on **within 3 hours**. Complaints flow through the C-Vigil module on ECINET.

**Build "MCC Mode" as a first-class feature** — a toggle, geo- and date-scoped:

- Freeze publication of new clips involving candidates in the affected constituencies during the silence period
- Suppress promotion of election-related clips from the homepage, notifications and social output
- Show a banner — deadpan, obviously:
  > *"🗳 The Committee is observing the Model Code of Conduct in [State]. New entries are suspended until polls close. We are being responsible. It is deeply unpleasant for everyone."*
- Auto-resume post-close. Log everything.

Elections are simultaneously your **highest-traffic** period and your **highest-risk** period. Being visibly the most compliant site in the space during an election cycle is worth more than the traffic you forgo — and it's the kind of thing journalists write about.

## 4.8 Hard content lines (enforced in code, not vibes)

**Automatic rejection, no reviewer discretion:**

1. Religion, caste, community, ethnicity, region-as-identity
2. Family, children, health, disability, appearance, personal life
3. Accent, pronunciation, English fluency, stammer, slip of the tongue
4. Anything synthetic — AI, dub, re-enactment, impersonation, speed/pitch edit
5. Non-public figures, private citizens, minors
6. Anything that could read as incitement, threat, or a call to action against a person or group
7. Sub-judice matters and anything touching an ongoing criminal proceeding
8. Statements made in a private capacity, off-record, or secretly recorded

Rule 6 matters more than it looks: **BNS §152 and §196** (acts endangering sovereignty/unity, promoting enmity between groups) are the provisions most likely to produce an FIR in a state you have never visited. A statement that is *about a claim* is safe territory; a statement that is *about a community* is not. The Rules of the Committee already draw this line — enforce it mechanically at submission, again in triage, and again at the human gate.

## 4.9 Risk register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| §69A blocking order | **Medium-High** | Critical | Verbatim only, enforced parity, own domain, offshore host, offshore backups, transparency report, counsel on retainer |
| Defamation notice / FIR | High | Medium | Verbatim doctrine, Tier A/B sourcing, neutral titles, right of reply, fast takedown, correction ledger |
| Copyright strike / DMCA | Medium | Low-Medium | **Embed first**; host only cleared, provenance-recorded excerpts; maintain takedown control, multi-source fallback, and transcripts as the durable asset |
| Coordinated brigading | **Very High** | High | Unchooseable duels, weighted votes, coordination detection, nightly recompute, public integrity report |
| Branded as partisan → dead | **Very High** | Critical | Parity meter, queue balancing, cross-party duels, monthly public audit, no loaded vocabulary |
| Loss of safe harbour (missed 3h) | Medium | Critical | Kill-switch + tested rota + pager from day one |
| Ad monetisation refused | High | Medium | Don't depend on ads — see `05-growth-and-money.md` |
| Contributor harassment / doxxing | Medium | High | Pseudonymous contribution by default, never expose emails, never require real names |
| Founder personal safety | Low-Medium | Critical | **Incorporate. Never operate personally.** Keep the entity, not a human name, on the masthead. |

**On that last row, plainly:** people who run political-satire projects in India get FIRs filed in distant states, get summoned, and occasionally get arrested. Kunal Kamra's experience is the reference case. Incorporate a company, put the entity on every page, keep a lawyer on retainer, and do not put your personal name and photo on a site that ranks politicians. This is normal operational hygiene for this category of publishing, not paranoia.

---

### Sources

- [IT Rules 2026: India Mandates Three-Hour Deepfake Takedowns and AI Content Labelling — Sansa Legal](https://www.sansalegal.com/post/it-rules-2026-india-mandates-three-hour-deepfake-takedowns-and-ai-content-labelling)
- [India targets deepfakes and AI-generated content: key changes under MeitY's 2026 amendments to the IT Rules — Freshfields](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/india-targets-deepfakes-and-ai-generated-content-key-changes-under-meitys-2026-102mjwn)
- [IT Rules 2026 Deepfake Regulation: Three Hour Takedowns And AI Labelling Obligations — Mondaq](https://www.mondaq.com/india/new-technology/1760554/it-rules-2026-deepfake-regulation-three-hour-takedowns-and-ai-labelling-obligations)
- [Delhi HC questions Raghav Chadha's personality rights plea — MediaNama](https://www.medianama.com/2026/05/223-delhi-hc-raghav-chadha-personality-rights-plea/)
- [Personality Rights in India: Legal Protection Guide — Intepat](https://www.intepat.com/blog/personality-rights-india)
- [Personality rights: The law must not overprotect fame — Supreme Court Observer](https://www.scobserver.in/journal/personality-rights-the-law-must-not-overprotect-fame/)
- [BNS Section 356: Defamation — Vakilsearch](https://vakilsearch.com/bns/sections/356)
- [Defamation law in India after the BNS — Niyam](https://niyam.ai/blog/defamation-law-india)
- [Section 79 IT Act: How 2026 IT Rules Reshape Safe Harbour — Prime Legal](https://blog.primelegal.in/section-79-it-act-safe-harbour-platform-liability/)
- [Safe Harbor and Content Moderation Regulation in India — Cambridge / Digital Planet (Tufts)](https://www.cambridge.org/core/books/defeating-disinformation/safe-harbor-and-content-moderation-regulation-in-india/F3CFF38410DE759B338D1ED6C519A559)
- [Prasar Bharati sends YouTube news channels copyright strikes for clips of Parliament, PM speeches — Scroll.in](https://scroll.in/article/1056536/prasar-bharati-sends-youtube-news-channels-copyright-strikes-for-clips-of-parliament-pm-speeches)
- [Prasar Bharati claims copyright on Parliament sessions, YouTube channels affected — The News Minute](https://www.thenewsminute.com/news/prasar-bharati-claims-copyright-on-parliament-sessions-youtube-channels-affected)
- [Indian Government Cracks Down on Video Reels Lampooning PM Modi — The Diplomat](https://thediplomat.com/2026/03/indian-government-cracks-down-on-video-reels-lampooning-pm-modi/)
- [Dozens of parody, satire accounts blocked in India as Centre cracks whip on social media — The South First](https://thesouthfirst.com/beyond-south/dozens-of-parody-satire-accounts-blocked-in-india-as-centre-cracks-whip-on-social-media/)
- [Instagram Blocks Comedian Pulkit Mani's Satirical Video on Narendra Modi — NewsGram](https://www.newsgram.com/india/2026/03/28/instagram-blocks-pulkit-mani-modi-satire)
- [Elections 2026: ECI Calls for Responsible Use of Social Media and AI Tools — SCC Online](https://www.scconline.com/blog/post/2026/04/21/eci-regulates-social-media-during-elections-2026/)
- [General Elections and bye-elections 2026: ECI action on unlawful social media content — PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2253528&reg=3&lang=1)
- [Pre-election silence period in India: What happens 48 hours before polls? — WION](https://www.wionews.com/india-news/pre-election-silence-period-what-happens-48-hours-before-polls-712400)
