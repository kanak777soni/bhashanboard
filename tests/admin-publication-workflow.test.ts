import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the entry editor separates draft saves from explicit publication", async () => {
  const [
    formSource,
    guardSource,
    actionSource,
    detailSource,
    newEntrySource,
    listSource,
    overviewSource,
    storeSource,
  ] = await Promise.all([
    readFile(new URL("../components/admin/EntryForm.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/admin/PublishGuard.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin/entries/[id]/page.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/admin/entries/new/page.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/admin/entries/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(formSource, /<select name="status"/);
  assert.match(formSource, /<form action=\{saveAction\}/);
  assert.match(formSource, /publicationAction[\s\S]*?: "publish"/);
  assert.match(formSource, /submitAction=\{publicationSubmitAction\}/);
  assert.match(guardSource, /name="workflow_action"/);
  assert.match(guardSource, /value=\{workflowAction\}/);
  assert.match(guardSource, /formAction=\{submitAction\}/);
  assert.match(guardSource, /data-publish-submit/);
  assert.match(guardSource, /disabled=\{!ready\}/);
  assert.match(guardSource, /Four profile marks/);
  assert.match(guardSource, /profileComplete/);
  assert.doesNotMatch(guardSource, /publishButton\.disabled|querySelector/);
  assert.match(formSource, /name="date"/);
  assert.match(formSource, /name="venue"/);
  assert.match(actionSource, /statementWorkflowAction\(fd\)/);
  assert.match(
    actionSource,
    /if \(!value\) return "save_draft"/
  );
  assert.match(actionSource, /getAll\("workflow_action"\)/);
  assert.match(
    actionSource,
    /submittedValues\.find\(\(item\) => item !== "save_draft"\)/
  );
  assert.doesNotMatch(formSource, /type="hidden" name="workflow_action"/);
  assert.match(
    actionSource,
    /function publishStatement[\s\S]*?fd\.set\("workflow_action", "publish"\)/
  );
  assert.match(
    actionSource,
    /function saveStatementDraft[\s\S]*?fd\.set\("workflow_action", "save_draft"\)/
  );
  assert.match(detailSource, /saveAction=\{saveStatementDraft\}/);
  assert.match(detailSource, /publishAction=\{publishStatement\}/);
  assert.match(detailSource, /restoreAction=\{restoreStatement\}/);
  assert.match(detailSource, /action=\{updateSarcasmProfile\}/);
  assert.match(detailSource, /SarcasmProfileFields/);
  assert.match(actionSource, /Complete all four Sarcasm Profile marks/);
  assert.match(actionSource, /Public GP and ballots unchanged/);
  assert.match(newEntrySource, /saveAction=\{createStatementDraft\}/);
  assert.match(newEntrySource, /publishAction=\{publishNewStatement\}/);
  assert.match(
    actionSource,
    /before\.status === "published"[\s\S]*?\? "held_review"[\s\S]*?: before\.status/
  );
  assert.match(actionSource, /result=restored/);
  assert.match(
    actionSource,
    /workflowAction === "publish" \? "live" : "saved"/
  );
  assert.match(detailSource, /label: "Now live"/);
  assert.match(detailSource, /role="status"/);
  assert.match(formSource, /list="statement-language-options"/);
  assert.doesNotMatch(formSource, /<select name="language"/);
  assert.match(
    formSource,
    /Research material remains[\s\S]*?not part of the publishing path/
  );
  assert.match(listSource, /Reader drafts/);
  assert.doesNotMatch(
    actionSource,
    /Play the YouTube publication preview and confirm/
  );
  assert.doesNotMatch(
    actionSource,
    /document\.verification\.stage = "committee_passed"/
  );
  assert.match(actionSource, /youtube_preview_ready/);
  assert.match(
    actionSource,
    /const stage = video \? requestedStage : "text_sourced"/
  );
  assert.match(actionSource, /fallback\?\.needs \?\? \[\]/);
  assert.match(actionSource, /parseMediaSourceUrl\(validatedUrl\)/);
  assert.match(actionSource, /recognizedMedia\?\.canonicalUrl \?\? validatedUrl/);
  assert.match(actionSource, /isSourceRole\(roleValue\)/);
  assert.match(formSource, /name=\{`src_role_\$\{index\}`\}/);
  assert.doesNotMatch(listSource, />Go live</);
  assert.match(listSource, /Preview & go live/);
  assert.match(listSource, /put back live/i);
  assert.doesNotMatch(listSource, /computeLadder|weightedScore|>GP</);
  assert.doesNotMatch(overviewSource, /Editorial seed order|Seed GP|computeLadder/);
  assert.match(overviewSource, /One person, one equal vote/);
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
  assert.match(uploadSource, /Keep it as an optional reference/);
  assert.doesNotMatch(uploadSource, /name="youtube_playback_attested"/);
  assert.match(
    uploadSource,
    /Optional preview\. Watching it through is not required/
  );
  assert.match(uploadSource, /youtube\.com\/iframe_api/);
  assert.match(uploadSource, /youtube-nocookie\.com/);
  assert.match(uploadSource, /cueVideoById/);
  assert.match(uploadSource, /getDuration/);
  assert.match(uploadSource, /youtubePlayerError/);
  assert.match(uploadSource, /name="youtube_preview_ready"/);
  assert.match(uploadSource, /Cloudinary setup incomplete/);
  assert.match(uploadSource, /configurationIssues/);
});
