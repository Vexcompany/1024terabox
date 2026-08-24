import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoEnterPath, shouldAutoEnter, splitListing, toListingItem } from "./listing.ts";
import { mapErrno } from "./errors.ts";
import type { FolderItem } from "./types.ts";

function folder(name: string, path: string, id = name): FolderItem {
  return { id, name, path, itemCount: null, isDir: true };
}

describe("folder auto-entry", () => {
  it("enters a single root folder with no files", () => {
    const next = shouldAutoEnter([folder("Season 1", "/Season 1")], []);
    assert.equal(next?.path, "/Season 1");
  });

  it("does not enter when multiple folders exist", () => {
    const next = shouldAutoEnter(
      [folder("A", "/A"), folder("B", "/B")],
      [],
    );
    assert.equal(next, null);
  });

  it("does not enter when files are present", () => {
    const files = splitListing([
      toListingItem({ fs_id: "1", server_filename: "a.mp4", isdir: "0", size: "10", path: "/a.mp4" })!,
    ]).files;
    const next = shouldAutoEnter([folder("A", "/A")], files);
    assert.equal(next, null);
  });

  it("walks nested single folders then stops on files", () => {
    const tree: Record<string, { folders: FolderItem[]; files: ReturnType<typeof splitListing>["files"] }> = {
      "/": { folders: [folder("Only", "/Only")], files: [] },
      "/Only": { folders: [folder("Nested", "/Only/Nested")], files: [] },
      "/Only/Nested": {
        folders: [],
        files: splitListing([
          toListingItem({
            fs_id: "9",
            server_filename: "clip.mp4",
            isdir: "0",
            size: "20",
            path: "/Only/Nested/clip.mp4",
            category: "1",
          })!,
        ]).files,
      },
    };
    const result = autoEnterPath("/", (path) => tree[path] ?? { folders: [], files: [] });
    assert.equal(result.path, "/Only/Nested");
    assert.equal(result.autoEntered, true);
    assert.equal(result.files[0]?.name, "clip.mp4");
  });
});

describe("errno mapping", () => {
  it("maps deleted, password, and verification codes", () => {
    assert.equal(mapErrno(-4, "share_unavailable", "x").code, "expired_share");
    assert.equal(mapErrno(-9, "share_unavailable", "x").code, "password_protected");
    assert.equal(mapErrno(4000020, "share_unavailable", "x").code, "security_verification");
    assert.equal(mapErrno(99, "folder_listing_failed", "nope").code, "folder_listing_failed");
  });
});
