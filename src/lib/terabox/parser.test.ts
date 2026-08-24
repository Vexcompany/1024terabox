import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShareError } from "./errors.ts";
import { normalizeSurl, parseShareUrl, shorturlForInfo, shorturlForList } from "./parser.ts";

describe("parseShareUrl", () => {
  it("parses 1024terabox /s/ links and strips the synthetic 1", () => {
    const parsed = parseShareUrl("https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w");
    assert.equal(parsed.surl, "qwJxYQ8hWfs1Sm7JeNrC6w");
    assert.equal(parsed.origin, "https://www.1024tera.com");
  });

  it("parses sharing/link query surl", () => {
    const parsed = parseShareUrl("https://www.terabox.app/sharing/link?surl=qwJxYQ8hWfs1Sm7JeNrC6w");
    assert.equal(parsed.surl, "qwJxYQ8hWfs1Sm7JeNrC6w");
    assert.equal(parsed.origin, "https://www.terabox.app");
  });

  it("parses terabox.com /s/ links", () => {
    const parsed = parseShareUrl("https://www.terabox.com/s/1LNr3tyl5pI5KUM8BecGtyQ");
    assert.equal(parsed.surl, "LNr3tyl5pI5KUM8BecGtyQ");
    assert.equal(parsed.origin, "https://www.terabox.com");
  });

  it("reads pwd from the query string", () => {
    const parsed = parseShareUrl("https://1024terabox.com/s/1abcdefghijk?pwd=ab12");
    assert.equal(parsed.password, "ab12");
  });

  it("rejects unsupported hosts", () => {
    assert.throws(
      () => parseShareUrl("https://example.com/s/1abcdefghijk"),
      (err: unknown) => err instanceof ShareError && err.code === "unsupported_domain",
    );
  });

  it("rejects missing share ids", () => {
    assert.throws(
      () => parseShareUrl("https://www.terabox.com/"),
      (err: unknown) => err instanceof ShareError && err.code === "invalid_url",
    );
  });

  it("rejects empty input", () => {
    assert.throws(
      () => parseShareUrl("   "),
      (err: unknown) => err instanceof ShareError && err.code === "invalid_url",
    );
  });

  it("rejects bare words as invalid URLs", () => {
    assert.throws(
      () => parseShareUrl("not-a-url"),
      (err: unknown) => err instanceof ShareError && err.code === "invalid_url",
    );
  });
});

describe("surl helpers", () => {
  it("normalizes and rebuilds shorturl variants", () => {
    assert.equal(normalizeSurl("1abcdeFGhiJK"), "abcdeFGhiJK");
    assert.equal(shorturlForInfo("abcdeFGhiJK"), "1abcdeFGhiJK");
    assert.equal(shorturlForList("1abcdeFGhiJK"), "abcdeFGhiJK");
  });
});
