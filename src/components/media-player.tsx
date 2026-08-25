import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaSuccess } from "@/lib/terabox/types";

function proxied(url: string): string {
  return `/api/proxy?u=${encodeURIComponent(url)}`;
}

function playbackSource(url: string): string {
  return url.startsWith("/") ? url : proxied(url);
}

export function MediaPlayer({ media }: { media: MediaSuccess }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Playback uses the merged HLS collector first. The direct URL remains
  // available for downloading, but public dlinks can point at a short preview.
  const playbackUrl = media.streamUrl || media.directUrl;
  const isHls = Boolean(media.streamUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    setError(null);
    setReady(false);

    const src = playbackSource(playbackUrl);
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    if (!isHls) {
      video.src = src;
      const onLoadedMetadata = () => setReady(true);
      const onError = () => setError("Playback failed. Try using Download instead.");
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
      void video.play().catch(() => undefined);
      return () => {
        cancelled = true;
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
      };
    }

    (async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;
      if (Hls.isSupported()) {
        const instance = new Hls({
          enableWorker: true,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
        });
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          setReady(true);
          void video.play().catch(() => undefined);
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("Playback failed. Try opening the stream in a new tab.");
        });
        hls = instance;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        setReady(true);
      } else {
        setError("This browser cannot play HLS streams.");
      }
    })().catch(() => setError("Could not start the player."));

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [playbackUrl, isHls]);

  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card">
      {playbackUrl ? (
        <div className="relative aspect-video bg-background">
          <video ref={videoRef} className="size-full" controls playsInline />
          {!ready && !error ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{media.name}</p>
          <p className="text-sm text-muted-foreground">{media.sizeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {media.directUrl ? (
            <Button onClick={() => window.open(proxied(media.directUrl!), "_blank")}>
              <Download className="size-4" />
              Download
            </Button>
          ) : media.streamUrl ? (
            <Button variant="secondary" onClick={() => window.open(media.streamUrl!, "_blank")}>
              Open stream
            </Button>
          ) : null}
        </div>
      </div>
      {media.limitation ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{media.limitation}</p>
      ) : null}
      {error ? (
        <p className="flex items-start gap-2 border-t border-border px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
