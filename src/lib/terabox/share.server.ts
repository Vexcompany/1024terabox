import { isDeletedErrno, isPasswordErrno, isVerificationErrno, mapErrno, ShareError } from "./errors.ts";
import { commonQuery, requestJson, requestText, type CookieBag, withQuery } from "./http.server.ts";
import { shorturlForInfo, shorturlForList } from "./parser.ts";
import type { ParsedShareUrl, ShareSession, UpstreamListItem } from "./types.ts";

const JS_TOKEN_RE = /fn%28%22([A-Fa-f0-9]+)%22/;
const TEMPLATE_RE = /var templateData = (\{.*?\});/;

type ShorturlInfo = {
  errno?: number;
  shareid?: number | string;
  uk?: number | string;
  sign?: string;
  timestamp?: number | string;
  title?: string;
  fcount?: number;
  list?: UpstreamListItem[];
  show_msg?: string;
};

type ShareList = {
  errno?: number;
  share_id?: number | string;
  uk?: number | string;
  title?: string;
  list?: UpstreamListItem[];
  show_msg?: string;
};

function extractTokens(html: string): { jsToken: string; pcftoken: string } {
  const jsToken = html.match(JS_TOKEN_RE)?.[1];
  if (!jsToken) {
    throw new ShareError(
      "malformed_upstream",
      "Could not read public-share tokens from the TeraBox page.",
      "missing jsToken",
    );
  }
  let pcftoken = "";
  const template = html.match(TEMPLATE_RE)?.[1];
  if (template) {
    try {
      const data = JSON.parse(template) as { pcftoken?: string };
      pcftoken = data.pcftoken ?? "";
    } catch {
      pcftoken = "";
    }
  }
  return { jsToken, pcftoken };
}

export async function openSharePage(parsed: ParsedShareUrl): Promise<{
  origin: string;
  cookies: CookieBag;
  jsToken: string;
  pcftoken: string;
}> {
  const pageUrl = `${parsed.origin}/sharing/link?surl=${encodeURIComponent(parsed.surl)}`;
  const page = await requestText(pageUrl, {});
  if (page.status >= 400) {
    throw new ShareError(
      "upstream_http_error",
      `TeraBox returned HTTP ${page.status} for this share page.`,
      `status=${page.status}`,
      502,
    );
  }
  const tokens = extractTokens(page.body);
  return {
    origin: parsed.origin,
    cookies: page.cookies,
    jsToken: tokens.jsToken,
    pcftoken: tokens.pcftoken,
  };
}

export async function fetchShorturlInfo(
  origin: string,
  surl: string,
  jsToken: string,
  pcftoken: string,
  cookies: CookieBag,
): Promise<{ info: ShorturlInfo; cookies: CookieBag }> {
  const url = withQuery(`${origin}/api/shorturlinfo`, {
    ...commonQuery({ jsToken, pcftoken }),
    shorturl: shorturlForInfo(surl),
    root: 1,
    scene: "",
  });
  const res = await requestJson<ShorturlInfo>(url, cookies, `${origin}/sharing/link?surl=${surl}`);
  return { info: res.json, cookies: res.cookies };
}

export async function fetchShareList(
  origin: string,
  surl: string,
  jsToken: string,
  pcftoken: string,
  cookies: CookieBag,
  dir?: string,
): Promise<{ listing: ShareList; cookies: CookieBag }> {
  const atRoot = !dir || dir === "/";
  const url = withQuery(`${origin}/share/list`, {
    ...commonQuery({ jsToken, pcftoken }),
    page: 1,
    num: 100,
    scene: "",
    shorturl: shorturlForList(surl),
    root: atRoot ? 1 : 0,
    dir: atRoot ? undefined : dir,
    by: "name",
    order: "asc",
  });
  const res = await requestJson<ShareList>(url, cookies, `${origin}/sharing/link?surl=${surl}`);
  return { listing: res.json, cookies: res.cookies };
}

export async function tryUnlockShare(
  origin: string,
  surl: string,
  jsToken: string,
  pcftoken: string,
  cookies: CookieBag,
  password: string,
): Promise<{ cookies: CookieBag; errno: number }> {
  const url = withQuery(`${origin}/share/verify`, {
    ...commonQuery({ jsToken, pcftoken }),
    surl: shorturlForList(surl),
  });
  const res = await requestJson<{ errno?: number; err_msg?: string }>(
    url,
    cookies,
    `${origin}/sharing/link?surl=${surl}`,
    { method: "POST", form: { pwd: password, vcode: "", vcode_str: "" } },
  );
  return { cookies: res.cookies, errno: Number(res.json.errno ?? -1) };
}

export function assertShareErrno(errno: unknown, context: "info" | "list"): void {
  if (Number(errno) === 0) return;
  if (isDeletedErrno(errno)) {
    throw mapErrno(errno, "expired_share", "This public share is no longer available.");
  }
  if (isPasswordErrno(errno)) {
    throw mapErrno(errno, "password_protected", "This share is password-protected.");
  }
  if (isVerificationErrno(errno)) {
    throw mapErrno(errno, "security_verification", "TeraBox requires security verification for this share.");
  }
  throw mapErrno(
    errno,
    context === "list" ? "folder_listing_failed" : "file_metadata_failed",
    context === "list" ? "Could not list this folder." : "Could not read share metadata.",
  );
}

export async function createSession(
  parsed: ParsedShareUrl,
  password?: string | null,
): Promise<{ session: ShareSession; info: ShorturlInfo }> {
  const page = await openSharePage(parsed);
  let cookies = page.cookies;
  const pwd = password || parsed.password;

  const first = await fetchShorturlInfo(page.origin, parsed.surl, page.jsToken, page.pcftoken, cookies);
  cookies = first.cookies;

  if (isPasswordErrno(first.info.errno) && pwd) {
    const unlocked = await tryUnlockShare(
      page.origin,
      parsed.surl,
      page.jsToken,
      page.pcftoken,
      cookies,
      pwd,
    );
    cookies = unlocked.cookies;
    if (unlocked.errno !== 0) {
      if (isPasswordErrno(unlocked.errno)) {
        throw new ShareError("incorrect_password", "That extraction password was not accepted.");
      }
      if (isVerificationErrno(unlocked.errno)) {
        throw new ShareError(
          "security_verification",
          "TeraBox is asking for a CAPTCHA on this password-protected share. That challenge is not solved here.",
        );
      }
      throw mapErrno(unlocked.errno, "password_protected", "Could not unlock this password-protected share.");
    }
  } else {
    assertShareErrno(first.info.errno, "info");
  }

  const infoRes = isPasswordErrno(first.info.errno)
    ? await fetchShorturlInfo(page.origin, parsed.surl, page.jsToken, page.pcftoken, cookies)
    : first;
  cookies = infoRes.cookies;
  assertShareErrno(infoRes.info.errno, "info");

  const info = infoRes.info;
  return {
    session: {
      origin: page.origin,
      surl: parsed.surl,
      jsToken: page.jsToken,
      pcftoken: page.pcftoken,
      cookies,
      shareId: String(info.shareid ?? ""),
      uk: String(info.uk ?? ""),
      sign: String(info.sign ?? ""),
      timestamp: String(info.timestamp ?? ""),
    },
    info,
  };
}
