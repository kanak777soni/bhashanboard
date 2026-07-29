import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCorpus, type RawStatement } from "../lib/corpus";
import {
  canConfigureExternalVotingVideo,
  canonicalizeMediaSourceUrl,
  parseFacebookMediaSourceUrl,
  parseInstagramMediaSourceUrl,
  parseMediaSourceUrl,
  parseYouTubeMediaSourceUrl,
} from "../lib/media-source";
import { SOURCE_ROLES } from "../lib/types";

const YOUTUBE_ID = "abcDEF_1234";
const FACEBOOK_ID = "123456789012345";

test("YouTube watch, short, live and embed links canonicalize to one URL", () => {
  const inputs = [
    `https://youtu.be/${YOUTUBE_ID}?t=40`,
    `https://www.youtube.com/watch?v=${YOUTUBE_ID}&feature=shared`,
    `https://m.youtube.com/shorts/${YOUTUBE_ID}?si=tracking`,
    `https://youtube.com/live/${YOUTUBE_ID}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?start=20`,
  ];

  for (const input of inputs) {
    assert.deepEqual(parseYouTubeMediaSourceUrl(input), {
      platform: "youtube",
      kind: "video",
      id: YOUTUBE_ID,
      canonicalUrl: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
    });
  }
});

test("YouTube parsing rejects ambiguous, malformed and lookalike URLs", () => {
  const invalid = [
    `https://www.youtube.com.evil.example/watch?v=${YOUTUBE_ID}`,
    `https://youtube.com@evil.example/watch?v=${YOUTUBE_ID}`,
    `https://www.youtube.com/watch?v=${YOUTUBE_ID}&v=zyxWVUT_987`,
    `https://youtu.be/${YOUTUBE_ID}/extra`,
    "https://www.youtube.com/watch?v=too-short",
    `javascript:https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
  ];

  for (const input of invalid) {
    assert.equal(parseMediaSourceUrl(input), undefined, input);
  }
});

test("Facebook video, reel, share and safe fb.watch links are canonicalized", () => {
  assert.deepEqual(
    parseFacebookMediaSourceUrl(
      `https://www.facebook.com/watch/?v=${FACEBOOK_ID}&ref=sharing`
    ),
    {
      platform: "facebook",
      kind: "video",
      id: FACEBOOK_ID,
      canonicalUrl: `https://www.facebook.com/watch/?v=${FACEBOOK_ID}`,
    }
  );
  assert.equal(
    canonicalizeMediaSourceUrl(
      `https://m.facebook.com/example.page/videos/${FACEBOOK_ID}/?mibextid=abc`
    ),
    `https://www.facebook.com/watch/?v=${FACEBOOK_ID}`
  );
  assert.deepEqual(
    parseFacebookMediaSourceUrl(
      `https://www.facebook.com/reel/${FACEBOOK_ID}/?locale=en_GB`
    ),
    {
      platform: "facebook",
      kind: "reel",
      id: FACEBOOK_ID,
      canonicalUrl: `https://www.facebook.com/reel/${FACEBOOK_ID}/`,
    }
  );
  assert.deepEqual(
    parseFacebookMediaSourceUrl(
      "https://www.facebook.com/share/v/AbC_def-12/?mibextid=abc"
    ),
    {
      platform: "facebook",
      kind: "share",
      id: "AbC_def-12",
      canonicalUrl: "https://www.facebook.com/share/v/AbC_def-12/",
    }
  );
  assert.equal(
    canonicalizeMediaSourceUrl(
      "https://www.facebook.com/share/r/Reel_token-42/?mibextid=abc"
    ),
    "https://www.facebook.com/share/r/Reel_token-42/"
  );
  assert.deepEqual(
    parseFacebookMediaSourceUrl("https://fb.watch/AbC_def-12/?ref=share"),
    {
      platform: "facebook",
      kind: "shortlink",
      id: "AbC_def-12",
      canonicalUrl: "https://fb.watch/AbC_def-12/",
    }
  );
});

test("Facebook parsing rejects lookalikes and unsafe or ambiguous paths", () => {
  const invalid = [
    `https://facebook.com.evil.example/watch/?v=${FACEBOOK_ID}`,
    `https://facebook.com@evil.example/watch/?v=${FACEBOOK_ID}`,
    `https://www.facebook.com/watch/?v=${FACEBOOK_ID}&v=987654321012345`,
    "https://fb.watch/AbC_def-12/extra",
    "https://fb.watch/%2f%2fevil.example/",
    "https://www.facebook.com/watch/?v=not-a-video-id",
    "https://www.facebook.com/example/posts/123456789012345",
  ];

  for (const input of invalid) {
    assert.equal(parseMediaSourceUrl(input), undefined, input);
  }
});

test("Instagram p, reel and tv URLs canonicalize while profiles and lookalikes fail", () => {
  assert.deepEqual(
    parseInstagramMediaSourceUrl(
      "https://www.instagram.com/p/C9ab_CD-12/?igsh=tracking"
    ),
    {
      platform: "instagram",
      kind: "post",
      id: "C9ab_CD-12",
      canonicalUrl: "https://www.instagram.com/p/C9ab_CD-12/",
    }
  );
  assert.equal(
    canonicalizeMediaSourceUrl(
      "https://m.instagram.com/reel/DMLvAbc123_/?utm_source=ig_web_copy_link"
    ),
    "https://www.instagram.com/reel/DMLvAbc123_/"
  );
  assert.equal(
    canonicalizeMediaSourceUrl("https://instagram.com/tv/ABCdef12345/"),
    "https://www.instagram.com/tv/ABCdef12345/"
  );

  const invalid = [
    "https://instagram.com.evil.example/reel/DMLvAbc123_/",
    "https://instagram.com/a-profile/",
    "https://instagram.com/reel/DMLvAbc123_/embed/",
    "https://instagram.com/reel/%2f%2fevil.example/",
  ];
  for (const input of invalid) {
    assert.equal(parseMediaSourceUrl(input), undefined, input);
  }
});

test("only parsed YouTube sources may configure an external voting video", () => {
  const youtube = parseMediaSourceUrl(
    `https://www.youtube.com/watch?v=${YOUTUBE_ID}`
  );
  const facebook = parseMediaSourceUrl(
    `https://www.facebook.com/watch/?v=${FACEBOOK_ID}`
  );
  const instagram = parseMediaSourceUrl(
    "https://www.instagram.com/reel/DMLvAbc123_/"
  );

  assert.ok(youtube && canConfigureExternalVotingVideo(youtube));
  assert.ok(facebook && !canConfigureExternalVotingVideo(facebook));
  assert.ok(instagram && !canConfigureExternalVotingVideo(instagram));
});

test("statement sources retain an optional, closed provenance role", async () => {
  assert.deepEqual(SOURCE_ROLES, [
    "footage",
    "reporting",
    "context",
    "fact_check",
  ]);

  const statement: RawStatement = {
    id: "IN-0001",
    status: "held_review",
    speaker_id: "speaker",
    party_at_time: "IND",
    office_at_time: "Citizen",
    state: "Delhi",
    date: "2026-01-01",
    venue: "Delhi",
    language: "Hindi",
    category: "Science & Reason",
    neutral_title: "On a test statement",
    quote: "मूल कथन",
    quote_translation: "Original statement",
    claim: "A test claim.",
    context: "Context.",
    axes: {
      logic_damage: 1,
      straight_face: 1,
      rewatch_value: 1,
      crowd_complicity: 1,
      consequence: 1,
    },
    verification: {
      stage: "text_sourced",
      best_source_tier: "A",
      sources: [
        {
          tier: "A",
          publisher: "Example",
          title: "Original footage",
          url: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
          role: "footage",
        },
      ],
    },
  };
  const corpus = buildCorpus(
    {
      statements: [statement],
      politicians: [
        {
          id: "speaker",
          name: "Speaker",
          party: "IND",
          state: "Delhi",
        },
      ],
      parties: [{ id: "IND", name: "Independent" }],
    },
    "2026-01-02"
  );
  assert.equal(corpus.CORPUS[0].sources[0].role, "footage");

  const schema = JSON.parse(
    await readFile(
      new URL("../data/schema/statement.schema.json", import.meta.url),
      "utf8"
    )
  );
  assert.deepEqual(
    schema.$defs.statement.properties.verification.properties.sources.items
      .properties.role.enum,
    [...SOURCE_ROLES]
  );
});
