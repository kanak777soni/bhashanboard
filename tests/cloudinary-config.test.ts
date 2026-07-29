import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudinaryApiKeyIsAcceptable,
  cloudinaryApiSecretIsAcceptable,
  cloudinaryCloudNameIsAcceptable,
  cloudinaryConfigurationIssues,
  cloudinaryCredentialIssues,
  cloudinaryPresetIsAcceptable,
  cloudinaryUploadPresetIssues,
} from "../lib/cloudinary-config";

const validEnvironment = {
  CLOUDINARY_CLOUD_NAME: "bhashanboard-prod",
  CLOUDINARY_API_KEY: "123456789012345",
  CLOUDINARY_API_SECRET: "long-random-secret-value",
  CLOUDINARY_VIDEO_UPLOAD_PRESET: "bhashanboard_signed_video",
};

test("Cloudinary configuration accepts complete non-placeholder credentials", () => {
  assert.deepEqual(cloudinaryConfigurationIssues(validEnvironment), []);
  assert.equal(cloudinaryCloudNameIsAcceptable(" board_cloud-1 "), true);
  assert.equal(cloudinaryApiKeyIsAcceptable(" api_key-123 "), true);
  assert.equal(cloudinaryApiSecretIsAcceptable(" sufficiently-random-secret "), true);
  assert.equal(cloudinaryPresetIsAcceptable(" signed_video-1 "), true);
});

test("Cloudinary configuration reports every missing value in a stable order", () => {
  assert.deepEqual(cloudinaryCredentialIssues({}), [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]);
  assert.deepEqual(cloudinaryConfigurationIssues({}), [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_VIDEO_UPLOAD_PRESET",
  ]);
});

test("Cloudinary configuration rejects placeholders and weak malformed values", () => {
  assert.equal(cloudinaryCloudNameIsAcceptable("your-cloud-name"), false);
  assert.equal(cloudinaryCloudNameIsAcceptable("contains a space"), false);
  assert.equal(cloudinaryApiKeyIsAcceptable("12345"), false);
  assert.equal(cloudinaryApiKeyIsAcceptable("your_api_key"), false);
  assert.equal(cloudinaryApiSecretIsAcceptable("aaaaaaaaaaaaaaaa"), false);
  assert.equal(cloudinaryApiSecretIsAcceptable("replace-with-secret"), false);
  assert.equal(cloudinaryPresetIsAcceptable("placeholder"), false);
  assert.equal(cloudinaryPresetIsAcceptable("-starts-with-dash"), false);

  assert.deepEqual(
    cloudinaryConfigurationIssues({
      CLOUDINARY_CLOUD_NAME: "your-cloud-name",
      CLOUDINARY_API_KEY: "12345",
      CLOUDINARY_API_SECRET: "aaaaaaaaaaaaaaaa",
      CLOUDINARY_VIDEO_UPLOAD_PRESET: "replace_with_preset",
    }),
    [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "CLOUDINARY_VIDEO_UPLOAD_PRESET",
    ]
  );
});

test("the dedicated Cloudinary upload preset must fail closed", () => {
  const validPreset = {
    name: "bhashanboard_signed_video",
    unsigned: false,
    settings: {
      allowed_formats: ["mp4", "mov", "webm"],
      max_file_size: 50 * 1024 * 1024,
      type: "authenticated",
      overwrite: false,
      use_filename: false,
      unique_filename: false,
    },
  };
  assert.deepEqual(cloudinaryUploadPresetIssues(validPreset), []);
  assert.deepEqual(cloudinaryUploadPresetIssues(null), ["invalid_response"]);

  const unsafe = structuredClone(validPreset);
  unsafe.unsigned = true;
  Object.assign(unsafe, {
    live: true,
    disallow_public_id: true,
  });
  Object.assign(unsafe.settings, {
    allowed_formats: ["mp4"],
    max_file_size: 100 * 1024 * 1024,
    type: "upload",
    eager: "q_auto",
    folder: "unexpected",
    overwrite: true,
  });
  assert.deepEqual(cloudinaryUploadPresetIssues(unsafe), [
    "must_be_signed",
    "max_file_size",
    "allowed_formats",
    "delivery_type",
    "eager",
    "folder",
    "live",
    "disallow_public_id",
    "overwrite",
  ]);
});
