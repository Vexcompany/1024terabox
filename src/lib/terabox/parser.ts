import { ShareError } from "./errors.ts";
import type { ParsedShareUrl } from "./types.ts";

export const SUPPORTED_HOSTS = [
  "1024terabox.com",
  "www.1024terabox.com",
  "1024tera.com",
  "www.1024tera.com",
  "dm.1024tera.com",
  "terabox.com",
  "www.terabox.com",
  "dm.terabox.com",
  "terabox.app",
  "www.terabox.app",
  "terabox.co",
  "www.terabox.co",
  "teraboxapp.com",
  "www.teraboxapp.com",
  "nephobox.com",
  "www.nephobox.com",
  "freeterabox.com",
  "www.freeterabox.com",
] as const;

function canonicalOrigin(host: string): string {
  const h = host.toLowerCase();
  if (h.endsWith("1024tera.com") || h.endsWith("1024terabox.com")) {
    return "https://www.1024tera.com";
  }
  if (h.endsWith("terabox.app")) {
    return "https://www.terabox.app";
  }
  return "https://www.terabox.com";
}

/** TeraBox /s/ links prefix the id with a synthetic "1". */
export function normalizeSurl(raw: string): string {
  const trimmed = decodeURIComponent(raw.trim());
  return trimmed.startsWith("1") && trimmed.length > 8 ? trimmed.slice(1) : trimmed;
}

export function isSupportedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.endsWith("terabox.com") ||
    h.endsWith("terabox.app") ||
    h.endsWith("1024tera.com") ||
    h.endsWith("1024terabox.com") ||
    h.endsWith("terabox.co") ||
    h.endsWith("teraboxapp.com") ||
    h.endsWith("nephobox.com") ||
    h.endsWith("freeterabox.com")
  );
}

export function parseShareUrl(input: string): ParsedShareUrl {
  const raw = input.trim();
  if (!raw) {
    throw new ShareError("invalid_url", "Paste a public TeraBox share link.");
  }

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new ShareError("invalid_url", "That does not look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ShareError("invalid_url", "Only http(s) share links are supported.");
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) {
    throw new ShareError("invalid_url", "That does not look like a valid URL.");
  }
  if (!isSupportedHost(host)) {
    throw new ShareError(
      "unsupported_domain",
      "That domain is not a TeraBox / 1024TeraBox public-share host.",
      host,
    );
  }

  const password = url.searchParams.get("pwd") || url.searchParams.get("password") || null;
  const querySurl = url.searchParams.get("surl");
  const pathMatch = url.pathname.match(/\/s\/([^/?#]+)/);

  let surl: string | null = null;
  if (pathMatch?.[1]) {
    surl = normalizeSurl(pathMatch[1]);
  } else if (querySurl) {
    surl = normalizeSurl(querySurl);
  }

  if (!surl) {
    throw new ShareError(
      "invalid_url",
      "Could not find a share id. Use a /s/1… link or a sharing/link?surl=… URL.",
    );
  }

  if (!/^[A-Za-z0-9_-]{8,}$/.test(surl)) {
    throw new ShareError("invalid_url", "The share id in that URL looks malformed.");
  }

  return {
    original: raw,
    origin: canonicalOrigin(host),
    host,
    surl,
    password,
  };
}

export function shorturlForInfo(surl: string): string {
  return surl.startsWith("1") ? surl : `1${surl}`;
}

export function shorturlForList(surl: string): string {
  return normalizeSurl(surl);
}
