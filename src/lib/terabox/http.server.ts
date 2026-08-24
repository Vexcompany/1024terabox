import { ShareError } from "./errors.ts";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const TIMEOUT_MS = 20_000;

export type CookieBag = Record<string, string>;

export function cookieHeader(cookies: CookieBag): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function mergeSetCookies(current: CookieBag, headers: Headers): CookieBag {
  const next = { ...current };
  const list =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : [];
  for (const raw of list) {
    const pair = raw.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) next[name] = value;
  }
  return next;
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ShareError("upstream_timeout", "TeraBox took too long to respond.", url, 504);
    }
    throw new ShareError(
      "upstream_http_error",
      "Could not reach TeraBox.",
      err instanceof Error ? err.message : "network",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function requestText(
  url: string,
  cookies: CookieBag,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; headers: Headers; body: string; cookies: CookieBag }> {
  const response = await withTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: cookieHeader(cookies),
      ...extraHeaders,
    },
  });
  const nextCookies = mergeSetCookies(cookies, response.headers);
  const body = await response.text();
  return { status: response.status, headers: response.headers, body, cookies: nextCookies };
}

export async function requestRaw(
  url: string,
  cookies: CookieBag,
  referer: string,
  init?: { method?: "GET" | "POST"; form?: Record<string, string> },
): Promise<{ status: number; raw: string; cookies: CookieBag; contentType: string }> {
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "application/json, application/vnd.apple.mpegurl, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
    Cookie: cookieHeader(cookies),
  };
  let body: string | undefined;
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init?.form ?? {}).toString();
  }
  const response = await withTimeout(url, { method, headers, body });
  const nextCookies = mergeSetCookies(cookies, response.headers);
  const raw = await response.text();
  if (response.status >= 500) {
    throw new ShareError(
      "upstream_http_error",
      `TeraBox returned HTTP ${response.status}.`,
      `status=${response.status}`,
      502,
    );
  }
  return {
    status: response.status,
    raw,
    cookies: nextCookies,
    contentType: response.headers.get("content-type") || "",
  };
}

export async function requestJson<T>(
  url: string,
  cookies: CookieBag,
  referer: string,
  init?: { method?: "GET" | "POST"; form?: Record<string, string> },
): Promise<{ status: number; json: T; cookies: CookieBag; raw: string }> {
  const res = await requestRaw(url, cookies, referer, init);
  let json: T;
  try {
    json = JSON.parse(res.raw) as T;
  } catch {
    throw new ShareError(
      "malformed_upstream",
      "TeraBox returned a non-JSON response.",
      `status=${res.status} contentType=${res.contentType}`,
      502,
    );
  }
  return { status: res.status, json, cookies: res.cookies, raw: res.raw };
}

export function commonQuery(session: {
  jsToken: string;
  pcftoken: string;
}): Record<string, string> {
  return {
    clientfrom: "h5",
    psign: "0",
    pcftoken: session.pcftoken,
    clienttype: "0",
    channel: "dubox",
    app_id: "250528",
    web: "1",
    jsToken: session.jsToken,
  };
}

export function withQuery(base: string, params: Record<string, string | number | undefined | null>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}
