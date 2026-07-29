import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the entry editor separates draft saves from explicit publication", async () => {
  const [formSource, actionSource, listSource, overviewSource, storeSource] = await Promise.all([
    readFile(new URL("../components/admin/EntryForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/entries/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(formSource, /<select name="status"/);
  assert.match(formSource, /name="workflow_action"\s+value="save_draft"/);
  assert.match(formSource, /name="workflow_action"\s+value="publish"/);
  assert.match(formSource, /data-publish-submit/);
  assert.match(formSource, /name="date"/);
  assert.match(formSource, /name="venue"/);
  assert.match(actionSource, /statementWorkflowAction\(fd\)/);
  assert.match(
    actionSource,
    /before\.status === "private_draft"[\s\S]*?\? "private_draft"[\s\S]*?: "held_review"/
  );
  assert.match(formSource, /list="statement-language-options"/);
  assert.doesNotMatch(formSource, /<select name="language"/);
  assert.match(formSource, /Private submission drafts are excluded from every public page/);
  assert.match(listSource, /Private submissions/);
  assert.match(
    actionSource,
    /Play the YouTube publication preview and confirm/
  );
  assert.match(actionSource, /parseMediaSourceUrl\(validatedUrl\)/);
  assert.match(actionSource, /recognizedMedia\?\.canonicalUrl \?\? validatedUrl/);
  assert.match(actionSource, /isSourceRole\(roleValue\)/);
  assert.match(formSource, /name=\{`src_role_\$\{i\}`\}/);
  assert.doesNotMatch(listSource, />Go live</);
  assert.match(listSource, /Review & publish/);
  assert.doesNotMatch(listSource, /computeLadder|weightedScore|>GP</);
  assert.doesNotMatch(overviewSource, /Editorial seed order|Seed GP|computeLadder/);
  assert.match(overviewSource, /Equal-weight public rulings only/);
  assert.match(
    storeSource,
    /WHEN \$\{status\}::text = 'published' THEN document[\s\S]*?'\{hall_of_fame\}'[\s\S]*?'false'::jsonb/
  );
});

test("video choices expose direct upload and an in-admin YouTube preview", async () => {
  const uploadSource = await readFile(
    new URL(
      "../components/admin/CloudinaryVideoUploadField.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(uploadSource, /className="media-source-cards"/);
  assert.match(uploadSource, />Upload video file</);
  assert.match(uploadSource, />Paste YouTube link</);
  assert.match(uploadSource, />Facebook \/ Instagram link</);
  assert.match(uploadSource, /Accepted as source evidence/);
  assert.match(uploadSource, /name="youtube_playback_attested"/);
  assert.match(uploadSource, /youtube-nocookie\.com\/embed/);
  assert.match(uploadSource, /Cloudinary setup incomplete/);
  assert.match(uploadSource, /configurationIssues/);
});
