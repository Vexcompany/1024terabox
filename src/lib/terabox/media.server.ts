import { createHmac } from "node:crypto";
import { mapErrno, ShareError } from "./errors.ts";
import { commonQuery, requestJson, requestRaw, withQuery } from "./http.server.ts";
import type { ShareSession } from "./types.ts";

/**
 * Public HMAC key from TeraBox's own web-share player bundle
 * (`crypto-vendor` export HmacSHA1, default key in `shareLink.js`).
 * This is a client-side player signing key, not an account credential.
 */
const STREAM_HMAC_KEY = "iuuPc64E4Fhn0rTXEzrnbLph0o5qyEEa";

const STREAM_TYPES = [
  "M3U8_AUTO_480",
  "M3U8_AUTO_360",
  "M3U8_FLV_264_480",
  "M3U8_FLV_264_360",
  "M3U8_AUTO_720",
  "M3U8_AUTO_1080",
] as const;

function streamSign(browserid: string, timestamp: string): string {
  const message = `0dubox${browserid}${timestamp}`;
  return createHmac("sha1", STREAM_HMAC_KEY).update(message).digest("hex");
}

function looksLikeM3u8(text: string): boolean {
  return text.trimStart().startsWith("#EXTM3U");
}

export async function resolveStreamUrl(session: ShareSession, fsId: string): Promise<string | null> {
  const browserid = session.cookies.browserid || "";
  if (!browserid || !session.shareId || !session.uk) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = streamSign(browserid, timestamp);
  const referer = `${session.origin}/sharing/link?surl=${session.surl}`;

  for (const type of STREAM_TYPES) {
    const url = withQuery(`${session.origin}/share/streaming`, {
      ...commonQuery(session),
      uk: session.uk,
      shareid: session.shareId,
      type,
      fid: fsId,
      sign,
      timestamp,
      esl: "1",
      isplayer: "1",
      ehps: "1",
    });
    const res = await requestRaw(url, session.cookies, referer);
    if (looksLikeM3u8(res.raw)) return url;
    try {
      const parsed = JSON.parse(res.raw) as { errno?: number };
      if (Number(parsed.errno) === 130) continue;
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveDownloadUrl(session: ShareSession, fsId: string): Promise<string | null> {
  if (!session.shareId || !session.uk || !session.sign) return null;
  const referer = `${session.origin}/sharing/link?surl=${session.surl}`;
  const url = withQuery(`${session.origin}/share/download`, {
    ...commonQuery(session),
    scene: "",
    bdstoken: "",
    shareid: session.shareId,
    type: "dlink",
    sign: session.sign,
    timestamp: session.timestamp,
    need_speed: "0",
  });
  const res = await requestJson<{ errno?: number; dlink?: string; list?: Array<{ dlink?: string }> }>(
    url,
    session.cookies,
    referer,
    {
      method: "POST",
      form: {
        product: "share",
        uk: session.uk,
        fid_list: JSON.stringify([Number(fsId) || fsId]),
        primaryid: session.shareId,
      },
    },
  );
  if (Number(res.json.errno) === 0) {
    const dlink = res.json.dlink || res.json.list?.[0]?.dlink;
    return dlink || null;
  }
  if (Number(res.json.errno) === 2) {
    return null;
  }
  throw mapErrno(res.json.errno, "media_resolution_failed", "Could not resolve a download URL.");
}

export function downloadLimitation(directUrl: string | null, streamUrl: string | null): string | null {
  if (directUrl) return null;
  if (streamUrl) {
    return "TeraBox did not expose a direct file download for this unauthenticated public share. Playback uses the public share stream instead.";
  }
  throw new ShareError(
    "media_resolution_failed",
    "TeraBox did not expose a playable or downloadable URL for this file without signing in.",
  );
}
