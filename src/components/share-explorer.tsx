import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  File,
  Film,
  Folder,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music,
} from "lucide-react";
import { inspectShareFn, resolveMediaFn } from "@/lib/terabox/actions";
import type { FileItem, FolderItem, InspectSuccess, MediaSuccess } from "@/lib/terabox/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaPlayer } from "@/components/media-player";

const SAMPLES = [
  {
    label: "Live video",
    url: "https://1024terabox.com/s/1LNr3tyl5pI5KUM8BecGtyQ",
  },
  {
    label: "Deleted sample",
    url: "https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w",
  },
];

function iconFor(file: FileItem) {
  if (file.mediaType === "video") return Film;
  if (file.mediaType === "audio") return Music;
  if (file.mediaType === "image") return ImageIcon;
  return File;
}

export function ShareExplorer() {
  const [url, setUrl] = useState(SAMPLES[0].url);
  const [password, setPassword] = useState("");
  const [listing, setListing] = useState<InspectSuccess | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaSuccess | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const needsPassword = error?.code === "password_protected" || error?.code === "incorrect_password";

  async function inspect(nextUrl: string, dir?: string) {
    setLoading(true);
    setError(null);
    setMedia(null);
    try {
      const result = await inspectShareFn({
        data: { url: nextUrl, dir, password: password || undefined },
      });
      if (!result.success) {
        setListing(null);
        setError(result.error);
        return;
      }
      setListing(result);
    } catch (err) {
      setListing(null);
      setError({
        code: "share_unavailable",
        message: err instanceof Error ? err.message : "Could not inspect this share.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function openFolder(folder: FolderItem) {
    await inspect(url, folder.path);
  }

  async function openFile(file: FileItem) {
    setResolvingId(file.id);
    setError(null);
    try {
      const result = await resolveMediaFn({
        data: { url, fsId: file.id, password: password || undefined, dir: listing?.path },
      });
      if (!result.success) {
        setError(result.error);
        setMedia(null);
        return;
      }
      setMedia(result);
    } catch (err) {
      setError({
        code: "media_resolution_failed",
        message: err instanceof Error ? err.message : "Could not resolve this file.",
      });
    } finally {
      setResolvingId(null);
    }
  }

  const countLabel = useMemo(() => {
    if (!listing) return null;
    const bits = [];
    if (listing.folders.length) bits.push(`${listing.folders.length} folder${listing.folders.length === 1 ? "" : "s"}`);
    if (listing.files.length) bits.push(`${listing.files.length} file${listing.files.length === 1 ? "" : "s"}`);
    return bits.join(" · ") || "Empty folder";
  }, [listing]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Public share explorer</p>
        <h1 className="font-display max-w-2xl text-4xl leading-[1.1] tracking-[-0.03em] text-foreground sm:text-5xl">
          Open a TeraBox link. Browse the real folder tree. Play one file at a time.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Built against TeraBox's public share APIs. Listing stays cheap. Media URLs are resolved only when you select a file.
        </p>
      </header>

      <form
        className="rounded-[var(--radius-xl)] border border-border bg-card p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void inspect(url);
        }}
      >
        <label className="sr-only" htmlFor="share-url">
          Public share URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="share-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://1024terabox.com/s/1…"
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Inspect
          </Button>
        </div>
        {needsPassword ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="share-pwd">
              Extraction password
            </label>
            <Input
              id="share-pwd"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="4-character code"
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.url}
              type="button"
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setUrl(sample.url);
                void inspect(sample.url);
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </form>

      {error ? (
        <div className="flex gap-3 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">{error.message}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{error.code}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : null}

      {listing && !loading ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl tracking-[-0.02em]">{listing.title}</h2>
              <p className="text-sm text-muted-foreground">
                {countLabel}
                {listing.autoEntered ? " · opened the only folder" : ""}
              </p>
            </div>
            <Badge>{listing.share.surl}</Badge>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {listing.crumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3.5" /> : null}
                <button
                  type="button"
                  className="rounded-sm hover:text-foreground"
                  onClick={() => void inspect(url, crumb.path)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>

          {media ? <MediaPlayer media={media} /> : null}

          <ul className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card">
            {listing.folders.map((folder) => (
              <li key={folder.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                  onClick={() => void openFolder(folder)}
                >
                  <Folder className="size-5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
            {listing.files.map((file) => {
              const Icon = iconFor(file);
              const active = resolvingId === file.id;
              return (
                <li key={file.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                    onClick={() => void openFile(file)}
                    disabled={Boolean(resolvingId)}
                  >
                    <Icon className="size-5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{file.sizeLabel}</span>
                    </span>
                    {active ? <Loader2 className="size-4 animate-spin" /> : <Badge>{file.mediaType}</Badge>}
                  </button>
                </li>
              );
            })}
            {listing.folders.length === 0 && listing.files.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">This folder is empty.</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
