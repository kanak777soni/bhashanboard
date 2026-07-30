-- Apply one neutral, statement-level editorial review to the complete seed corpus.
-- These four marks describe the text currently on record. They do not create
-- public votes, GP, rank, Standings eligibility, or Hall eligibility.
SELECT
  set_config('bhashan.actor', 'editorial-board', true),
  set_config('bhashan.action', 'seed', true),
  set_config(
    'bhashan.detail',
    'Applied the reviewed four-mark editorial profile to the existing 45-entry corpus.',
    true
  );

-- statement-breakpoint
WITH editorial_scores (
  id,
  logic_damage,
  reality_gap,
  straight_face,
  rewatch_value
) AS (
  VALUES
    ('IN-0001', 4, 5, 5, 5),
    ('IN-0002', 5, 5, 5, 5),
    ('IN-0003', 5, 5, 5, 4),
    ('IN-0004', 4, 4, 5, 4),
    ('IN-0005', 5, 5, 5, 5),
    ('IN-0006', 5, 5, 5, 5),
    ('IN-0007', 4, 5, 4, 5),
    ('IN-0008', 2, 2, 3, 3),
    ('IN-0009', 1, 0, 4, 4),
    ('IN-0010', 0, 0, 0, 0),
    ('IN-0011', 1, 1, 3, 2),
    ('IN-0012', 3, 2, 4, 3),
    ('IN-0013', 4, 4, 4, 3),
    ('IN-0014', 1, 1, 4, 2),
    ('IN-0015', 1, 2, 4, 1),
    ('IN-0016', 1, 1, 2, 3),
    ('IN-0017', 4, 4, 4, 3),
    ('IN-0018', 5, 5, 3, 3),
    ('IN-0019', 1, 0, 4, 4),
    ('IN-0020', 1, 2, 2, 2),
    ('IN-0021', 0, 0, 1, 0),
    ('IN-0022', 0, 0, 2, 1),
    ('IN-0023', 1, 4, 3, 1),
    ('IN-0024', 1, 1, 2, 1),
    ('IN-0025', 3, 0, 2, 2),
    ('IN-0026', 1, 0, 2, 1),
    ('IN-0027', 0, 0, 2, 1),
    ('IN-0028', 0, 0, 1, 1),
    ('IN-0029', 0, 0, 4, 3),
    ('IN-0030', 4, 5, 4, 5),
    ('IN-0031', 5, 5, 5, 5),
    ('IN-0032', 4, 5, 4, 4),
    ('IN-0033', 5, 5, 5, 5),
    ('IN-0034', 5, 4, 4, 4),
    ('IN-0035', 5, 5, 4, 5),
    ('IN-0036', 3, 4, 4, 3),
    ('IN-0037', 2, 4, 2, 2),
    ('IN-0038', 1, 3, 2, 2),
    ('IN-0039', 5, 5, 4, 4),
    ('IN-0040', 0, 0, 0, 0),
    ('IN-0041', 0, 0, 4, 1),
    ('IN-0042', 4, 5, 5, 5),
    ('IN-0043', 5, 5, 5, 3),
    ('IN-0044', 2, 2, 4, 1),
    ('IN-0045', 2, 3, 4, 4)
)
UPDATE bhashan.statements AS statement
SET document = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        statement.document,
        '{axes,logic_damage}',
        to_jsonb(editorial_scores.logic_damage),
        true
      ),
      '{axes,reality_gap}',
      to_jsonb(editorial_scores.reality_gap),
      true
    ),
    '{axes,straight_face}',
    to_jsonb(editorial_scores.straight_face),
    true
  ),
  '{axes,rewatch_value}',
  to_jsonb(editorial_scores.rewatch_value),
  true
)
FROM editorial_scores
WHERE statement.id = editorial_scores.id
  AND ROW(
    (statement.document #>> '{axes,logic_damage}')::integer,
    (statement.document #>> '{axes,reality_gap}')::integer,
    (statement.document #>> '{axes,straight_face}')::integer,
    (statement.document #>> '{axes,rewatch_value}')::integer
  ) IS DISTINCT FROM ROW(
    editorial_scores.logic_damage,
    editorial_scores.reality_gap,
    editorial_scores.straight_face,
    editorial_scores.rewatch_value
  );
