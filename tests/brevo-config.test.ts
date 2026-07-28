import assert from "node:assert/strict";
import test from "node:test";
import {
  brevoApiKeyIsAcceptable,
  mailConfigurationIssues,
  senderEmailIsAcceptable,
} from "../lib/brevo-config";

test("Brevo configuration rejects placeholders and malformed senders", () => {
  assert.equal(brevoApiKeyIsAcceptable("replace-with-your-brevo-api-key"), false);
  assert.equal(brevoApiKeyIsAcceptable("xkeysib-realistic-secret-material"), true);
  assert.equal(senderEmailIsAcceptable("not-an-email"), false);
  assert.equal(senderEmailIsAcceptable("mail@example.com"), true);
  assert.deepEqual(
    mailConfigurationIssues({
      BREVO_API_KEY: "replace-with-your-brevo-api-key",
      BREVO_SENDER_EMAIL: "not-an-email",
      BREVO_VERIFY_TEMPLATE_ID: "zero",
    }),
    ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_VERIFY_TEMPLATE_ID"]
  );
});

test("Brevo templates are optional but positive when present", () => {
  assert.deepEqual(
    mailConfigurationIssues({
      BREVO_API_KEY: "xkeysib-realistic-secret-material",
      BREVO_SENDER_EMAIL: "mail@example.com",
    }),
    []
  );
  assert.deepEqual(
    mailConfigurationIssues({
      BREVO_API_KEY: "xkeysib-realistic-secret-material",
      BREVO_SENDER_EMAIL: "mail@example.com",
      BREVO_RESET_TEMPLATE_ID: "0",
    }),
    ["BREVO_RESET_TEMPLATE_ID"]
  );
});
