import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectShare, resolveMedia } from "./extract.server.ts";

const SAMPLE_DELETED = "https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w";
const SAMPLE_FILE = "https://1024terabox.com/s/1LNr3tyl5pI5KUM8BecGtyQ";
const SAMPLE_PASSWORD = "https://www.terabox.app/sharing/link?surl=CcI0dJJ2nzNs9rO6u23QAw";

describe("live public-share flow", { timeout: 60_000 }, () => {
  it("reports the provided sample as deleted/unavailable", async () => {
    const result = await inspectShare(SAMPLE_DELETED);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, "expired_share");
    }
  });

  it("lists a live single-file share without resolving media", async () => {
    const result = await inspectShare(SAMPLE_FILE);
    assert.equal(result.success, true);
    if (result.success) {
      assert.ok(result.files.length >= 1);
      assert.equal(result.files[0]?.mediaType, "video");
      assert.ok(!("directUrl" in result.files[0]));
    }
  });

  it("resolves an HLS stream for a selected video", async () => {
    const listed = await inspectShare(SAMPLE_FILE);
    assert.equal(listed.success, true);
    if (!listed.success) return;
    const file = listed.files[0];
    assert.ok(file);
    const media = await resolveMedia(SAMPLE_FILE, file.id, undefined, listed.path);
    assert.equal(media.success, true);
    if (media.success) {
      assert.equal(media.streamKind, "hls");
      assert.ok(media.streamUrl);
      assert.match(media.streamUrl, /\/share\/streaming/);
    }
  });

  it("detects password-protected shares", async () => {
    const result = await inspectShare(SAMPLE_PASSWORD);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, "password_protected");
    }
  });

  it("rejects invalid URLs with a specific code", async () => {
    const result = await inspectShare("not-a-url");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.code === "invalid_url" || result.error.code === "unsupported_domain");
    }
  });
});
