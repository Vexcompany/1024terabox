import type { MediaType, UpstreamListItem } from "./types.ts";

const VIDEO_EXT = new Set(["mp4", "mkv", "webm", "avi", "mov", "m4v", "flv", "ts", "m3u8"]);
const AUDIO_EXT = new Set(["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "iso"]);
const DOC_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"]);

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function mediaTypeOf(name: string, category?: string | number | null): MediaType {
  const ext = extensionOf(name);
  if (VIDEO_EXT.has(ext) || String(category) === "1") return "video";
  if (AUDIO_EXT.has(ext) || String(category) === "2") return "audio";
  if (IMAGE_EXT.has(ext) || String(category) === "3") return "image";
  if (DOC_EXT.has(ext) || String(category) === "4") return "document";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  return "file";
}

export function formatSize(bytes: number | string | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export function isDirItem(item: UpstreamListItem): boolean {
  return String(item.isdir ?? "0") === "1";
}

export function itemName(item: UpstreamListItem): string {
  return item.server_filename || item.path?.split("/").filter(Boolean).pop() || "Untitled";
}

export function itemPath(item: UpstreamListItem): string {
  return item.path || `/${itemName(item)}`;
}

export function itemId(item: UpstreamListItem): string {
  return String(item.fs_id ?? "");
}

export function pickThumbnail(item: UpstreamListItem): string | null {
  const thumbs = item.thumbs;
  if (!thumbs) return null;
  return thumbs.url3 || thumbs.url2 || thumbs.url1 || thumbs.icon || null;
}

export function parentPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function crumbsFor(path: string): { name: string; path: string }[] {
  const parts = path.split("/").filter(Boolean);
  const crumbs = [{ name: "Share", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ name: part, path: acc });
  }
  return crumbs;
}
