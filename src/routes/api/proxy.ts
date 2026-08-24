import { createFileRoute } from "@tanstack/react-router";
import { BROWSER_UA } from "@/lib/terabox/http.server.ts";
import { proxyAllowed } from "@/lib/terabox/extract.server.ts";

function rewritePlaylist(body: string, playlistUrl: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      try {
        const absolute = new URL(trimmed, playlistUrl).toString();
        return `/api/proxy?u=${encodeURIComponent(absolute)}`;
      } catch {
        return line;
      }
    })
    .join("\n");
}

export const Route = createFileRoute("/api/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u");
        if (!target || !proxyAllowed(target)) {
          return new Response("Forbidden", { status: 403 });
        }
        const range = request.headers.get("range");
        const upstream = await fetch(target, {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "*/*",
            ...(range ? { Range: range } : {}),
          },
          redirect: "follow",
        });
        const contentType = upstream.headers.get("content-type") || "application/octet-stream";
        if (contentType.includes("mpegurl") || target.includes("/share/streaming")) {
          const text = await upstream.text();
          const rewritten = rewritePlaylist(text, target);
          return new Response(rewritten, {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Cache-Control": "no-store",
            },
          });
        }
        const headers = new Headers();
        headers.set("Content-Type", contentType);
        const length = upstream.headers.get("content-length");
        if (length) headers.set("Content-Length", length);
        const acceptRanges = upstream.headers.get("accept-ranges");
        if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) headers.set("Content-Range", contentRange);
        headers.set("Cache-Control", "private, max-age=60");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
