import { createFileRoute } from "@tanstack/react-router";
import { createSession } from "@/lib/terabox/share.server.ts";
import { parseShareUrl } from "@/lib/terabox/parser.ts";
import { resolveMergedStreamPlaylist } from "@/lib/terabox/media.server.ts";

function rewriteSegments(body: string, requestUrl: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      try {
        const absolute = new URL(trimmed, requestUrl).toString();
        return `/api/proxy?u=${encodeURIComponent(absolute)}`;
      } catch {
        return line;
      }
    })
    .join("\n");
}

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const requestUrl = new URL(request.url);
          const shareUrl = requestUrl.searchParams.get("url");
          const fsId = requestUrl.searchParams.get("fsId");
          const password = requestUrl.searchParams.get("password") || undefined;

          if (!shareUrl || !fsId) {
            return new Response("Missing url or fsId", { status: 400 });
          }

          const parsed = parseShareUrl(shareUrl);
          const { session } = await createSession(parsed, password);
          const playlist = await resolveMergedStreamPlaylist(session, fsId);

          if (!playlist) {
            return new Response("Unable to resolve a playable stream", { status: 502 });
          }

          return new Response(rewriteSegments(playlist, requestUrl.origin), {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
            },
          });
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Stream resolution failed", {
            status: 502,
          });
        }
      },
    },
  },
});
