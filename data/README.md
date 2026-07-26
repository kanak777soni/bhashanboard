# `data/` — the corpus

The archive itself. `docs/09-seed-corpus.md` explains what is in here, how it was
built, and what is missing. This file is the working reference for adding to it.

```
data/
  statements.json     the corpus — one canonical entry per statement
  politicians.json    speaker register
  parties.json        party register + parity-meter plate colours
  rejected.json       the rejection ledger — what was turned down, and under which rule
  schema/             JSON Schema for statements.json
  generated/          DERIVED. Never hand-edit. Rebuilt by tools/seed-rank.mjs
```

```
node tools/seed-rank.mjs          # validate + report
node tools/seed-rank.mjs --write  # also rebuild generated/leaderboard.json
```

Exit code 1 means an error. Warnings are outstanding research, not failures — at
present every entry carries at least one, because nothing has cleared Stage 3.

## The two rules that are not negotiable

**1. `quote` is verbatim or it is `null`.** Never paraphrase into it, never
reconstruct it from reported speech, never tidy the grammar, never translate into
it without saying so in `quote_note`. If you only have "the minister said that
cows exhale oxygen", that is a `claim`, not a `quote`.

The temptation is real and it arrives every single time: the entry looks so much
better with a sentence in it. A corpus that has yielded to that once is worthless,
because from then on no reader can tell which sentences are real. **A null quote
is a research task. An invented quote is the end of the project.**

**2. Embed, never host.** `verification.embed` takes `{platform, id, start_s,
end_s}`. A file path in that field is a bug. See `docs/03-content-pipeline.md`
§3.1 — Prasar Bharati has issued strikes over Parliament footage, and self-hosting
means you personally receive them.

## Adding an entry

1. **Check the rejection ledger first.** If it is in `rejected.json`, it has
   already been argued. Re-propose only with new facts, not a new opinion.
2. **Run the four gates** in `docs/09-seed-corpus.md` §9.2. Rule 1 (religion,
   caste, community) and Rule 3 (slips of the tongue) reject more candidates than
   everything else combined.
3. **Write a neutral title.** State what was claimed, never a verdict about the
   person. *"On radar and cloud cover"* — never *"MP thinks clouds block radar"*.
   The validator warns if the title does not start "On …", which is a crude proxy
   for a real rule, not a substitute for it.
4. **Attach sources with honest tiers.** A/B is required to publish; C is a lead.
   `best_source_tier` must equal the best tier actually listed — the validator
   checks, so do not aspirationally upgrade it.
5. **Fill `needs`** with the specific outstanding work. That array is the research
   queue; an empty one on an unverified entry is a lie to the next contributor.
6. **Score the axes** against the rubric in §9.3. Note that **Consequence is
   inverted**: 5 means nothing happened or the speaker was promoted since, 0 means
   they resigned or were sacked.
7. **Set `status`.** `published` only if the parity cap still holds — run the
   script and look. Otherwise `held_parity`. If a Rule is engaged but you believe
   the entry survives it, `held_review` plus a `policy_note` recording the ruling
   and the reasoning.
8. **Re-run the script.** Zero errors, or it does not land.

## Party attribution

`party_at_time` is the party held **on the date of the statement**, not today.
Babul Supriyo (IN-0038) was BJP when he said it and is TMC now; the entry is BJP.
Defections are common enough in Indian politics that getting this wrong quietly
corrupts the parity meter, which is the one number on the homepage that has to be
beyond argument.

`politicians.json` carries the speaker's *current* affiliation for the player
card. The two fields disagree on purpose.

## The parity cap

No party above **30%** of the published set (`docs/03-content-pipeline.md` §3.4).
The script enforces it as an error. When the cap binds, hold entries at
`held_parity` — do not delete them, and do not raise the cap.

It also warns when one party dominates the *top* of the ladder, which the
headcount cap does not catch. Nobody counts a leaderboard; they look at the
podium. **The fix for either is always more corpus and never a thumb on the
ratings.** Re-weighting the rubric to move a party down the table is precisely
the corruption the whole Elo design exists to prevent, and it is visible to
anyone who diffs the numbers.

## `generated/leaderboard.json`

Provisional ratings derived from the rubric so the board has a spread before any
duels exist. Every row is `provisional: true`, `duels: 0`. When the Elo engine
ships with real ballots, it overwrites all of this and `tools/seed-rank.mjs` gets
deleted. It is scaffolding, and it is meant to be thrown away.

Read the ladder from this file. Read everything else from `statements.json`. Join
on `id`.
