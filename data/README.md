# `data/` — the corpus

> **Current scoring note (July 2026).** The seed-rank files and Elo references
> below document the retired cold-start design. The live application has no
> editorial prior: after qualifying playback, each verified account may enter
> one immutable ruling per statement and performance is the arithmetic mean of
> those equal-strength rulings. Aamne-Saamne is a non-scoring exhibition.

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

**1. `quote` is original-language verbatim or it is `null`.** Never paraphrase
into it, reconstruct it from reported speech, tidy the grammar, or back-translate
an English report. Put a faithful English rendering in `quote_translation`. If
you only have "the minister said that cows exhale oxygen", that is a `claim`, not
a `quote`.

The temptation is real and it arrives every single time: the entry looks so much
better with a sentence in it. A corpus that has yielded to that once is worthless,
because from then on no reader can tell which sentences are real. **A null quote
is a research task. An invented quote is the end of the project.**

**2. Embed first; host only cleared evidence.** A YouTube
`verification.embed` takes `{platform, id, start_s, end_s}`; a file path or URL
in that field is a bug. The admin may attach a verified Cloudinary asset only
through the signed upload and playback-approval flow, and only when the project
owns the excerpt, has permission to host it, or has recorded a lawful archival
basis. See `docs/03-content-pipeline.md` §3.1. Cloudinary asset metadata is never
accepted from the JSON seed importer: create or edit the entry in the
administrator UI so its actor-bound upload, provider verification, and approval
record exists in Neon.

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
6. **Record the internal research axes** against the historical rubric in §9.3.
   They help the desk describe and audit its research, but never set public GP,
   tier, or rank. Note that **Consequence is inverted**: 5 means nothing happened
   or the speaker was promoted since, 0 means they resigned or were sacked.
7. **Set `status`.** `published` is a content/evidence decision, never a way to
   manufacture a party percentage. Use `held_review` when sourcing, context,
   duplication or a Rule remains unresolved, with a `policy_note` where a Rule is
   engaged. Coverage warnings govern the next research assignment, not which
   already-qualified statement is hidden.
8. **Re-run the script.** Zero errors, or it does not land.

## Party attribution

`party_at_time` is the party held **on the date of the statement**, not today.
Babul Supriyo (IN-0038) was BJP when he said it and is TMC now; the entry is BJP.
Defections are common enough in Indian politics that getting this wrong quietly
corrupts the parity meter, which is the one number on the homepage that has to be
beyond argument.

`politicians.json` carries the speaker's *current* affiliation for the player
card. The two fields disagree on purpose.

## The parity target

No party above **30%** of the launch corpus remains the research target
(`docs/03-content-pipeline.md` §3.4). The script reports any breach loudly. It is
not permission to hide otherwise qualified records until the display looks
balanced: that would turn a sampling problem into editorial scorekeeping.
`held_parity` is retained for historical imports, but new holds must be justified
by evidence, context, duplication or the Rules.

Historical seed reports may still describe the old ladder for reproducibility.
They have no authority over the live table. **The fix for coverage imbalance is
more corpus; the fix for a weak entry is evidence review; neither is a thumb on
the ratings.** Public placement is determined only by equal-strength rulings.

## `generated/leaderboard.json`

This is a compatibility artifact retained for deterministic corpus imports and
historical reproducibility. It is not read as the public ranking. Under the
current fail-closed publication bar it is empty; public GP and rank come only
from validated database ballot aggregates after the ten-ruling threshold.
