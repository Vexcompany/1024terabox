import { createHmac } from "node:crypto";
import { mapErrno, ShareError } from "./errors.ts";
import { commonQuery, requestJson, requestRaw, withQuery } from "./http.server.ts";
import type { ShareSession } from "./types.ts";

const STREAM_HMAC_KEY = "iuuPc64E4Fhn0rTXEzrnbLph0o5qyEEa";

const STREAM_TYPES = [
  "M3U8_AUTO_1080",
  "M3U8_AUTO_720",
  "M3U8_AUTO_480",
  "M3U8_AUTO_360",
  "M3U8_FLV_264_480",
  "M3U8_FLV_264_360",
] as const;

function streamSign(browserid: string, timestamp: string): string {
  const message = `0dubox${browserid}${timestamp}`;
  return createHmac("sha1", STREAM_HMAC_KEY).update(message).digest("hex");
}

function looksLikeM3u8(text: string): boolean {
  return text.trimStart().startsWith("#EXTM3U");
}

function playlistDuration(text: string): number {
  if (!looksLikeM3u8(text)) return 0;
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#EXTINF:")) continue;
    const value = Number.parseFloat(line.slice(8).split(",", 1)[0] ?? "");
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

type StreamSegment = {
  duration: number;
  url: string;
  rangeStart: number;
  rangeEnd: number;
};

function parseRange(url: string): { start: number; end: number } | null {
  try {
    const range = new URL(url).searchParams.get("range");
    const match = range?.match(/^(\d+)-(\d+)$/);
    if (!match) return null;
    return { start: Number(match[1]), end: Number(match[2]) };
  } catch {
    return null;
  }
}

function parseSegments(text: string): StreamSegment[] {
  const lines = text.split(/\r?\n/);
  const segments: StreamSegment[] = [];
  let duration: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const value = Number.parseFloat(line.slice(8).split(",", 1)[0] ?? "");
      duration = Number.isFinite(value) ? value : null;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (duration === null) continue;

    const range = parseRange(line);
    if (range) {
      segments.push({ duration, url: line, rangeStart: range.start, rangeEnd: range.end });
    }
    duration = null;
  }

  return segments;
}

/**
 * The public streaming endpoint can expose one internal TS chunk per request.
 * Poll it repeatedly and stitch the signed TS URLs into one VOD playlist.
 */
export async function resolveMergedStreamPlaylist(
  session: ShareSession,
  fsId: string,
): Promise<string | null> {
  const browserid = session.cookies.browserid || "";
  if (!browserid || !session.shareId || !session.uk) return null;

  const referer = `${session.origin}/sharing/link?surl=${session.surl}`;
  const byRange = new Map<string, StreamSegment>();

  // Keep the same request shape that TeraBox's web player uses. The endpoint
  // chooses the internal chunk; repeated calls discover the remaining chunks.
  for (const type of STREAM_TYPES.slice(0, 4)) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const sign = streamSign(browserid, timestamp);
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
        start: "0",
      });

      try {
        const response = await requestRaw(url, session.cookies, referer);
        if (!looksLikeM3u8(response.raw)) continue;
        for (const segment of parseSegments(response.raw)) {
          const key = `${segment.rangeStart}-${segment.rangeEnd}`;
          if (!byRange.has(key)) byRange.set(key, segment);
        }
      } catch {
        // Keep probing; a transient upstream response should not discard
        // chunks already discovered from earlier requests.
      }
    }

    // If a quality produced useful chunks, do not hammer all lower qualities
    // unless the collector found nothing at all.
    if (byRange.size > 0) break;
  }

  const segments = [...byRange.values()].sort((a, b) => a.rangeStart - b.rangeStart);
  if (!segments.length) return null;

  const targetDuration = Math.max(1, Math.ceil(Math.max(...segments.map((s) => s.duration))));
  return [
    "#EXTM3U",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-VERSION:3",
    ...segments.flatMap((segment) => [`#EXTINF:${segment.duration},`, segment.url]),
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
}

export async function resolveStreamUrl(session: ShareSession, fsId: string): Promise<string | null> {
  const browserid = session.cookies.browserid || "";
  if (!browserid || !session.shareId || !session.uk) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = streamSign(browserid, timestamp);
  const referer = `${session.origin}/sharing/link?surl=${session.surl}`;

  const candidates: Array<{ url: string; duration: number; type: string }> = [];

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

    try {
      const res = await requestRaw(url, session.cookies, referer);
      if (looksLikeM3u8(res.raw)) {
        candidates.push({ url, duration: playlistDuration(res.raw), type });
        continue;
      }
      try {
        const parsed = JSON.parse(res.raw) as { errno?: number };
        if (Number(parsed.errno) === 130) continue;
      } catch {
        // Ignore non-JSON/non-M3U8 variants.
      }
    } catch {
      // Continue probing other qualities.
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.duration - a.duration);
  return candidates[0]?.url ?? null;
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
        nozip: "0",
        fid_list: JSON.stringify([Number(fsId) || fsId]),
        uk: session.uk,
        primaryid: session.shareId,
      },
    },
  );
  if (Number(res.json.errno) === 0) {
    const dlink = res.json.dlink || res.json.list?.[0]?.dlink;
    return dlink || null;
  }
  if (Number(res.json.errno) === 2) return null;
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
