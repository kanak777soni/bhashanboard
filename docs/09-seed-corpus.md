# 09 — The Seed Corpus (India)

> **Current scoring note (July 2026).** References in this design document to pairwise duels, Elo, weighted memberships, or internal placement votes are historical. The implemented authority is `/rules`: one equal-strength, immutable ruling per verified account and statement, after qualifying playback, with a published Bayesian seed prior. Aamne-Saamne is a non-scoring exhibition.

> **Historical corpus snapshot.** Counts and parity-holdback decisions below describe the original research pass, not the live database. As of 28 July 2026 the database contains 44 placed entries, 34 representatives, 22 parties, 16 refusals, and 14 established verbatim quotes; all 44 entries remain text-sourced. The database verification report and the public record are authoritative.

> The brief was: research the internet, find every foolish statement by an Indian politician, build a proper database, and rank the speeches. This document is the honest version of what that produced — what is in the corpus, how each entry got there, how the ranking was derived before a single duel has been fought, and the four places where the research does not yet reach.

**Files.** `data/statements.json` · `data/politicians.json` · `data/parties.json` · `data/rejected.json` · `data/schema/statement.schema.json` · `tools/seed-rank.mjs` · `data/generated/leaderboard.json`

```
node tools/seed-rank.mjs --write
```

## 9.0 Read this before anything else

Three things about this corpus that are easy to misread and expensive to misread.

**Nothing in it is publishable yet.** Every entry sits at `stage: "text_sourced"` — a named person, a real remark, at least one reputable outlet. Publication needs Stage 3: a Tier A/B clip, a timestamp, the surrounding sixty seconds watched, a transcript, subtitles, and a human sign-off (`03-content-pipeline.md` §3.3). The gap between "I have a news report" and "I have a verified clip" is where this category of site normally dies, so the schema names the gap in a field instead of letting it hide. The validator warns on all 41 entries. That is correct output, not a bug.

**Twenty-six of the 41 entries have `quote: null`.** Where the exact wording could not be established, the quote field is null and a `claim` — a neutral summary — carries the meaning instead. This is the Verbatim Doctrine doing its job at the one moment it costs something. It would have been trivial to write a plausible sentence into every quote field; a corpus that has done that once is worthless, because no reader can tell which sentence it was. **A null quote is a research task. An invented quote is the end of the project.**

**It is 41 entries, not 300.** The cold-start target is 300–500 (`03-content-pipeline.md` §3.4). This is a spine and a method, not a launch corpus. §9.6 has the backlog and the honest estimate of what closing it costs.

## 9.1 What the corpus contains

| | |
|---|---|
| Entries indexed | **41** |
| On the ladder (`published`) | **27** |
| Held for parity | 13 |
| Held for Committee review | 1 |
| Rejected under the Rules, with reasons | **14** (`data/rejected.json`) |
| Distinct representatives | 34 |
| Distinct parties | 10 |
| Distinct states | 17 |
| Distinct languages | 8 |
| Entries carrying a verbatim quote | 15 of 41 |

Parties represented: BJP, INC, SP, BRS, TMC, NCP, AAP, CPI(M), TDP, Shiv Sena (UBT). Rejected entries additionally cover DMK, JDU, RJD and IUML — the filter reaches parties the corpus does not yet, which is itself a finding.

Categories follow `02-ranking-system.md` §2.8: Science & Reason, History, Economics, Whataboutery, Standing Ovation.

## 9.2 How a statement got in

Four gates, in order. An entry that fails any one of them is in `rejected.json` with the rule that killed it, not silently absent.

1. **Public figure, public role, public statement.** Elected representatives, ministers, and official party spokespeople, speaking on the record. Nothing private, nothing secretly recorded, nothing from a non-politician. This is why the Indian Science Congress claims by university vice-chancellors — some of the most-quoted material in this genre — are not here. They are not politicians.
2. **Attribution established.** At least one reputable outlet naming the speaker. The nano-GPS-chip claim about the ₹2,000 note is the instructive failure: it appears in nearly every listicle on this subject, and no source could be found attaching it to a named politician. It is in the rejection ledger under sourcing, not in the corpus.
3. **The Rules of the Committee** (`04-legal-and-safety.md` §4.8), applied mechanically. Nothing on religion, caste, community or ethnicity; nothing on family, health, appearance or personal life; nothing on accent or slips of the tongue; nothing sub judice.
4. **Claims, not mouths.** The statement has to contain an assertion someone could argue with. A misspoken number is not an assertion.

### The rejection ledger is a feature

`data/rejected.json` holds fourteen statements that did not make it, each with the rule and the reasoning. It should ship public alongside the correction ledger required by §4.5. It stops the same famous clip being re-proposed monthly, and it is the only real evidence that the content policy is enforced rather than advertised.

Some of the rejections cost more than others, and those are the ones that matter:

- **Sam Pitroda's remark about how people in different regions look** was among the most-viewed political statements of 2024. Rule 1 and Rule 2. Out.
- **Mamata Banerjee's "1,500 kg" newborn** is a staple of every Bengal listicle. It is a misspoken unit — Rule 3. Out.
- **Pragya Thakur on cow urine and cancer** is the hardest call in the file. It is exactly the kind of medical claim the archive exists for, and it is inseparable from the speaker's own illness. Rule 2 carries no exception for volunteered health claims. The Committee resolves hard calls against publication. Out, with the reasoning recorded so the argument doesn't have to be had again from scratch.
- **Ajit Pawar's load-shedding remark** was made in the same speech as an entry that *is* in the corpus (IN-0019). Rejection operates per statement, not per speech. A rejected line does not taint the entry beside it, and an indexed entry does not launder the line beside it.

### Two rulings worth knowing about

Some entries engage a Rule without being killed by it, and those carry a `policy_note` recording the ruling:

- **IN-0002** (Modi on Ganesha and Karna) touches religion. Ruled in scope: the indexed claim is a claim about the history of medicine, made to doctors, at a hospital opening. The archive takes no position on the epics or on anyone's faith, and the copy must never imply it does.
- **IN-0009** (Rahul Gandhi on escape velocity) touches caste. Ruled in scope: the entry indexes the physics analogy. Rule 1 targets statements *about* caste identity; it does not exempt a politician's astrophysics from review because the speech was about something serious.

Both notes end the same way: if the entry cannot be titled and captioned without crossing the line, drop the entry. That instruction is in the data, not in someone's memory.

## 9.3 How the ranking was derived

The ranking system is duels and Elo (`02-ranking-system.md`). Duels need a corpus; a corpus needs a ladder to be worth duelling over. `tools/seed-rank.mjs` breaks that circle exactly once.

**Every entry is scored 0–5 on the five judgment axes from §2.5**, weighted:

| Axis | Weight | What a 5 means |
|---|---|---|
| 🧠 Logic Damage | 0.30 | A checkable claim about reality, and it is flatly wrong |
| 🎭 Straight Face | 0.20 | Delivered as settled fact, in an official setting, without a smile |
| 🔁 Rewatch Value | 0.20 | Survives retelling — it is funny as text, not just as video |
| 👏 Crowd Complicity | 0.15 | The room went along with it |
| 📉 Consequence | 0.15 | **5 = nothing happened, or promoted since. 0 = resigned or sacked.** |

That Consequence scale is inverted on purpose, and it is the sharpest thing in the rubric: it means the "Promoted Anyway" leaderboard falls out of the data rather than being hand-curated, and it makes the *institutional* response part of what is being ranked. Saji Cheriyan (IN-0024) scores 2 because he resigned within days. Harsh Vardhan (IN-0004) scores 5 because he was later given the Health Ministry.

**Scores are then mapped onto the target tier rarities, not onto an absolute scale.** Entries are ranked by weighted score and GP is interpolated within the tier bands from §2.4, calibrated so the seed corpus matches the target distribution — 28% Participation through 2.5% Kohinoor. This matters: on an absolute scale a pre-filtered corpus of notable statements would be almost entirely Gold and above, and a board where everything is Gold looks broken. Rarity is what makes a tier mean something.

The output is the spread the docs asked for:

| Tier | Seeded | Target |
|---|---|---|
| 👑 Kohinoor Class | 1 (3.7%) | 2.5% |
| 💎 Diamond Gyan | 2 (7.4%) | 8% |
| 🥇 Gold Standard | 4 (14.8%) | 16% |
| 🥈 Silver Tongue | 6 (22.2%) | 21% |
| 🥉 Bronze Bhashan | 6 (22.2%) | 24% |
| 🪵 Participation Certificate | 8 (29.6%) | 28% |

**All of it is provisional and all of it is disposable.** `provisional: true` on every row, `duels: 0`, `method: "seed_rubric_v1"`. The instant real ballots exist, Elo overwrites these numbers and `seed-rank.mjs` gets deleted. It is scaffolding — but scaffolding with a published formula, which is worth more than it looks: §4.2 warns that during Phase A the ranking is unambiguously the Committee's editorial act, and a written, reproducible criterion is enormously more defensible than undisclosed taste. Anyone can re-run the script and get the same ladder.

### The current top of the board

```
  1  1901  👑  BJP    On an attribution to Stephen Hawking — Harsh Vardhan
  2  1827  💎  BJP    On Ganesha, Karna and the antiquity of surgery — Narendra Modi
  3  1770  💎  BJP    On Sanjaya, satellites and the antiquity of the internet — Biplab Kumar Deb
  4  1727  🥇  BJP    On cloud cover and radar — Narendra Modi
  5  1692  🥇  BJP    On respiration in cattle — Vasudev Devnani
```

Which brings us to the problem.

## 9.4 The parity problem — the real finding

**The single most important result of this research is not any statement in the corpus. It is this: the well-documented Indian corpus is severely skewed towards the governing party, and that skew is a threat to the project.**

`01-concept.md` §1.5 and `03-content-pipeline.md` §3.4 both set a hard cap: no party above 30%. Enforcing it required holding **13 of 21 verified BJP entries off the ladder** (`status: "held_parity"`). They are not deleted — they are verified, sourced, queued, and waiting for headroom that only arrives when non-BJP sourcing catches up. The published set now sits at BJP 29.6%, INC 29.6%, and eight other parties sharing the remainder.

Why the skew exists is not mysterious, and the causes point at the fix:

1. **Twelve years of incumbency.** Ministers make statements in an official capacity, at official events, on official channels. Opposition backbenchers do not.
2. **Scrutiny follows power.** Fact-checking outlets, science journalists and academic media-criticism concentrate on the government of the day. Search "unscientific claims Indian politicians" and every compilation on the first page is organised around the ruling party. Search the mirror-image query and the results are about coalition arithmetic.
3. **English-language sourcing.** National English outlets cover Delhi densely and Patna, Bhubaneswar and Thiruvananthapuram thinly. Regional-language political speech is where the missing corpus lives, and it is not in English.
4. **Compilations inherit the bias.** Every listicle recycles the same forty items from the same three articles. Working from compilations reproduces their skew and calls it research.

Cause (3) is the actionable one, and it makes §3.5 look less like an accessibility feature and more like the core sourcing strategy: **regional-language capacity is not a translation problem, it is the parity problem.**

### Headcount parity is not position parity

The validator enforces the 30% cap on counts. It also warns about something the cap does not catch:

```
LADDER-HEAD: BJP holds 7 of the top 9 places (78%). Headcount parity is
satisfied; position parity is not.
```

Nobody counts a leaderboard. They look at the podium. A board that is 30/30 by headcount and BJP across the entire top tier will be called partisan on sight, and by §4.9 that is a *critical* risk with *very high* likelihood — it is the row most likely to kill the project.

**The fix is more corpus, never a thumb on the ladder.** Weighting the rubric to move a party down the table would be exactly the corruption the Elo design exists to prevent, and it would be indefensible the moment anyone diffed the numbers. The honest options are: find higher-scoring entries from other parties, or launch smaller and more balanced. Both are fine. Adjusting the scores is not.

### The recommendation

**Do not launch on this distribution.** Sequencing that fixes it:

1. Close the regional-language gap first (§9.6). Non-BJP entries come disproportionately from Tamil, Telugu, Bengali, Malayalam, Marathi and Odia sources.
2. Hold the 30% cap without exception, and publish the parity meter from day one — including the fact that entries are being held.
3. Publish the held queue *as content*. "The Committee is holding 13 verified entries because publishing them would breach the parity cap" is on-brand, disarming, and true. Concealing it and getting found out is the failure mode.

## 9.5 What is *not* in the corpus, and why

Four kinds of absence. Naming them is more useful than a bigger number would be.

**1. Regional-language material.** Effectively everything here was sourced through English-language reporting, including entries whose original was Bengali, Telugu, Marathi, Kannada or Malayalam. Whole categories are missing: state assembly proceedings in any language, district-level rally speech, most of the Northeast, and the Hindi-belt vernacular press. This is the largest gap by volume and the most consequential for parity.

**2. Statements that would be indexed if they were checkable.** Several strong candidates are `quote: null` and stay unpublishable until someone finds the footage — Harsh Vardhan's Hawking attribution (IN-0004) is the top of the ladder and still has no verbatim sentence. That is uncomfortable, and it should be: the top entry on the board is the one with the most outstanding verification work.

**3. Statements deliberately excluded.** Fourteen in the rejection ledger, plus a much larger class never written down: the enormous volume of Indian political speech that is communal, misogynistic or caste-based. That material is a large fraction of what "controversial statements by Indian politicians" returns, and none of it belongs here. The archive ranks arguments about reality. It is not a highlight reel of the worst things anyone has said.

**4. Pre-2012 material.** The corpus skews recent because online sourcing does. India's back catalogue runs for decades and is thin here.

### On "don't miss anyone"

Straight answer: not achievable, and worth being clear about rather than quietly approximating. India has roughly 4,000 MLAs and 800 MPs speaking in more than twenty languages, most of it never transcribed, much of it on channels that delete their archives. No search of any depth enumerates that. What is achievable is what §3.4 describes: a defensible seed, then a community ingest pipeline that scales past what any individual can watch. **This corpus is the seed and, more importantly, the method** — the schema, the four gates, the rejection ledger, the parity engine and the rubric are the reusable parts. Entry 400 should be added the same way entry 41 was.

## 9.6 The backlog, in priority order

Ordered by what unblocks the most.

| # | Work | Why first |
|---|---|---|
| 1 | **Regional-language sourcing: Tamil, Telugu, Bengali, Marathi, Malayalam, Kannada, Odia.** One contributor per language, sourcing from state assembly feeds and regional networks. | The parity problem and the volume problem are the same problem. Nothing else moves until this does. |
| 2 | **Assembly and Parliament records.** IN-0021, IN-0032, IN-0033, IN-0034, IN-0035, IN-0041 are all on the record in a House. §52(1)(q) makes legislature proceedings reproducible. | Six entries with a clean, legal, free route to Tier A verbatim text. Cheapest verbatim wins available. |
| 3 | **Clear the 26 `quote: null` entries.** | They cannot publish. The list is in the data — every entry names what it needs. |
| 4 | **Locate Tier A/B footage for all 41.** Party channels and official handles first: when a politician's own party uploaded it, "out of context" and "fake" both collapse. | Stage 3 is the gate for every entry in the file. |
| 5 | **Non-BJP entries at the top of the rubric.** Specifically: economic and scientific claims by state chief ministers of any party. | Fixes ladder-head concentration the only legitimate way. |
| 6 | **Pre-2012 back catalogue.** | Adds decades of range and is structurally less partisan, because the incumbency changes. |
| 7 | **Right of Reply outreach.** Every office in `politicians.json`, before launch, not after. | §4.6. It is the best defensive feature in the plan and it is free. Note that IN-0011's speaker has died — the entry must say so rather than showing an unanswered reply prompt. |

Rough shape of the effort: item 2 is days. Items 1 and 4 are the two focused weeks §3.4 budgets for, and only if the language contributors are found first.

## 9.7 Notes for whoever wires this into the site

- **Read the ladder from `data/generated/leaderboard.json`, never from `statements.json`.** The generated file is the ranking; the corpus is the source of truth for everything else. Join on `id`.
- **`party_at_time`, not the speaker's current party.** Babul Supriyo (IN-0038) was BJP when he said it and is TMC now. The parity meter counts `party_at_time`; a defection must not retroactively move an entry between party ladders.
- **Render `claim` when `quote` is null**, in the neutral-summary voice, visually distinct from a verbatim quote. Never style a summary to look like a quotation.
- **`neutral_title` is the display title.** It states what was claimed. The validator warns on any title that does not begin "On …" — that is a crude test for a real rule (§3.3), and passing it is not the same as satisfying it.
- **`counterpoint` belongs in the factual layer, `policy_note` never renders.** The Committee's sarcasm layer stays visually separate from both (§4.1(b)).
- **Nothing renders as published until `stage: "committee_passed"`.** Today that is zero entries. A staging view is fine; a public view is not.
- **The prototype's data is fictional and stays that way.** `prototype/index.html` is a design specimen and says so on its face. Wiring it to real data is a separate deliberate step, not a find-and-replace.

---

### Sources

Every entry in the corpus carries its own sources with tier ratings; this is the shared research trail.

- [The false scientific claims made during Modi's first term — The Caravan](https://caravanmagazine.in/science/false-scientific-claims-modi-first-term)
- [Vedic plastic surgery to test-tube Karna — non-science claims flowed from Modi downwards — ThePrint](https://theprint.in/science/vedic-plastic-surgery-to-test-tube-karna-non-science-claims-flowed-from-modi-downwards/174757/)
- [BJP and Science: From Ganesha's plastic surgery to 'Yoga can cure cancer' — Alt News](https://www.altnews.in/bjp-science-ganeshas-plastic-surgery-yoga-can-cure-cancer/)
- [Minister ridiculed for saying ancient India invented internet — BBC News](https://www.bbc.com/news/world-asia-india-43806078)
- [Politicians insist India had the internet thousands of years ago — The Irish Times](https://www.irishtimes.com/news/world/asia-pacific/politicians-insist-india-had-the-internet-thousands-of-years-ago-1.3467467)
- [PM Twice Wrong: Clouds Do Not Hinder Radar, May Hinder Weapons — FactChecker.in](https://www.factchecker.in/pm-twice-wrong-clouds-do-not-hinder-radar-may-hinder-weapons)
- [Nobody saw ape turning into man, Darwin's theory is wrong: Union minister — Scroll.in](https://scroll.in/latest/865803/nobody-saw-ape-turning-into-man-charles-darwins-theory-of-evolution-is-wrong-union-minister)
- [Stephen Hawking said Vedic theory superior to Einstein's: Science Minister Vardhan — The Tribune](https://www.tribuneindia.com/news/archive/nation/stephen-hawking-said-vedic-theory-superior-to-einstein-s-science-minister-vardhan-558705)
- [Cow only animal that inhales, exhales oxygen: Rajasthan education minister — Business Standard](https://www.business-standard.com/article/current-affairs/cow-only-animal-that-inhales-exhales-oxygen-rajasthan-education-minister-117011600484_1.html)
- [Cow exhales oxygen, helps cure tuberculosis, claims Uttarakhand CM — Onmanorama](https://www.onmanorama.com/news/india/2019/07/27/uttarakhand-cm-controversy-cow-exhales-oxygen-comment.html)
- [Gaumutra, gobar could cure coronavirus, BJP MLA tells Assam assembly — Deccan Herald](https://www.deccanherald.com/india/gaumutra-gobar-could-cure-coronavirus-bjp-mla-tells-assam-assembly-809845.html)
- [Speaking Sanskrit helps control diabetes and cholesterol, claims BJP MP — Scroll.in](https://scroll.in/latest/946712/speaking-sanskrit-helps-control-diabetes-and-cholesterol-claims-bjp-mp)
- [Why We Hope Our Education Minister's Remarks on Science Don't Enter Our Books — The Quint](https://www.thequint.com/elections/modi-cabinet-hrd-minister-ramesh-pokhriyal-remarks-on-astrology-science-nuclear-tests)
- ['Maths never helped Einstein discover gravity': Piyush Goyal on economy — The Tribune](https://www.tribuneindia.com/news/archive/nation/maths-never-helped-einstein-discover-gravity-piyush-goyal-on-economy-831585/)
- [Auto Slowdown: Facts, numbers, economics belie FM Sitharaman's Ola Uber argument — Business Today](https://www.businesstoday.in/latest/slowdown-blues/story/auto-slowdown-facts-numbers-economics-belie-finance-minister-nirmala-sitharaman-ola-uber-argument-229328-2019-09-11)
- ['If selling pakodas is a job, so is begging': P Chidambaram's jibe — Scroll.in](https://scroll.in/latest/866754/if-selling-pakodas-is-a-job-so-is-begging-p-chidambarams-jibe-sparks-twitter-war-with-bjp)
- [Rahul Gandhi 'escape velocity' speech sets social media ablaze — Gulf News](https://gulfnews.com/world/asia/india/rahul-gandhi-escape-velocity-speech-sets-social-media-ablaze-1.1241458)
- [Minister faces flak for hailing price rise — Deccan Herald](https://www.deccanherald.com/india/minister-faces-flak-hailing-price-2355183)
- [Karnataka minister defends his 'puja' to please rain God — InUth](https://www.inuth.com/india/karnataka-minister-defends-his-puja-to-please-rain-god-says-even-isro-does-it-before-launching-rockets/)
- [Karnataka Minister Sparks Outrage with Wishing for Droughts Remark on Farmers — Deccan Chronicle](https://www.deccanchronicle.com/nation/in-other-news/251223/karnataka-ministers-controversial-remark-sparks-outrage-bjp-calls-fo.html)
- [Narendra Modi 'Shani' afflicting India, says former Karnataka Speaker — Deccan Herald](https://www.deccanherald.com/elections/india/lok-sabha-polls-2024-narendra-modi-shani-afflicting-india-former-karnataka-speaker-ramesh-kumar-2988833)
- [Digvijaya demands 'proof' of surgical strikes — ThePrint](https://theprint.in/india/digvijaya-demands-proof-of-surgical-strikes-bjp-on-offensive-congress-says-views-personal/1330616/)
- ['How can I trust BJP's vaccine?' — Akhilesh Yadav says won't take Covid shot — ThePrint](https://theprint.in/india/how-can-i-trust-bjps-vaccine-akhilesh-yadav-says-wont-take-covid-shot/578277/)
- ['Should I urinate to fill up empty dams': Ajit Pawar's statement in 2013 — Free Press Journal](https://www.freepressjournal.in/mumbai/should-i-urinate-to-fill-up-empty-dams-maha-deputy-cm-ajit-pawars-shocking-statement-in-2013)
- [Covid-19: Telangana's hope turns into despair in 24 hours — Deccan Herald](https://www.deccanherald.com/national/south/covid-19-telangana-s-hope-turns-into-despair-in-24-hours-820108.html)
- [Delhi's Smog Tower Country's Third, Not First as Kejriwal Claimed — FactChecker.in](https://www.factchecker.in/fact-check/delhi-pollution-smog-tower-india-first-kejriwal-claim-770089)
- [Kerala: Facing Backlash for Remarks on Constitution, Saji Cheriyan Resigns — The Wire](https://thewire.in/government/kerala-saji-cheriyan-minister-resign-constitution)
- [Twitter Milks BJP Leader Dilip Ghosh's Golden Comment on Indian Cows — The Wire](https://thewire.in/politics/dilip-ghosh-comment-indian-cows)
- [Bengal politicians' affair with foot-in-mouth remarks — Deccan Herald](https://www.deccanherald.com/india/bengal-politicians-affair-with-foot-in-mouth-remarks-774401.html)
- [Yoga can cure cancer, according to Bengaluru-based institute's research: AYUSH minister — Scroll.in](https://scroll.in/latest/805761/yoga-can-cure-cancer-according-to-bengaluru-based-institutes-research-ayush-minister)
- [Coronavirus becoming popular expression for political attacks — Deccan Herald](https://www.deccanherald.com/india/coronavirus-becoming-popular-expression-for-political-attacks-815043.html)
- [No, the new Rs 2,000 note will not have a 'nano GPS chip' — Scroll.in](https://scroll.in/article/821078/no-the-new-rs-2000-note-will-not-have-a-nano-gps-chip-that-can-track-it-anywhere)
- [Foot in the mouth: eccentric quotes by politicians that made headlines in 2024 — Deccan Herald](https://www.deccanherald.com/india/foot-in-the-mouth-eccentric-quotes-by-politicians-that-made-headlines-in-2024-3337145)
