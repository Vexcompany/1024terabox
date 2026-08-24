import { failure, ShareError } from "./errors.ts";
import { crumbsFor } from "./format.ts";
import { splitListing, toListingItem } from "./listing.ts";
import { downloadLimitation, resolveDownloadUrl, resolveStreamUrl } from "./media.server.ts";
import { parseShareUrl } from "./parser.ts";
import { assertShareErrno, createSession, fetchShareList } from "./share.server.ts";
import type {
  FileItem,
  FolderItem,
  InspectResult,
  MediaResult,
  ShareMeta,
  ShareSession,
  UpstreamListItem,
} from "./types.ts";

function safeLog(event: string, data: Record<string, unknown>) {
  console.info(`[terabox] ${event}`, {
    ...data,
  });
}

function toItems(list: UpstreamListItem[] | undefined) {
  return (list ?? []).map(toListingItem).filter((item): item is NonNullable<typeof item> => item !== null);
}

function metaFromSession(session: ShareSession, title: string, fileCount: number | null): ShareMeta {
  return {
    surl: session.surl,
    origin: session.origin,
    shareId: session.shareId,
    uk: session.uk,
    title,
    fileCount,
  };
}

async function listDir(
  session: ShareSession,
  dir: string,
): Promise<{ folders: FolderItem[]; files: FileItem[]; title: string }> {
  const { listing, cookies } = await fetchShareList(
    session.origin,
    session.surl,
    session.jsToken,
    session.pcftoken,
    session.cookies,
    dir,
  );
  session.cookies = cookies;
  if (listing.share_id) session.shareId = String(listing.share_id);
  if (listing.uk) session.uk = String(listing.uk);
  assertShareErrno(listing.errno, "list");
  const items = toItems(listing.list);
  const { folders, files } = splitListing(items);
  safeLog("list", {
    dir,
    errno: listing.errno,
    folders: folders.length,
    files: files.length,
    itemKeys: listing.list?.[0] ? Object.keys(listing.list[0]) : [],
  });
  return { folders, files, title: listing.title || "" };
}

export async function inspectShare(url: string, dir?: string, password?: string): Promise<InspectResult> {
  try {
    const parsed = parseShareUrl(url);
    const { session, info } = await createSession(parsed, password);
    const startPath = dir && dir !== "/" ? dir : "/";

    let current = await listDir(session, startPath);
    let path = startPath;
    let autoEntered = false;
    let depth = 0;
    while (current.folders.length === 1 && current.files.length === 0 && depth < 8) {
      path = current.folders[0].path;
      autoEntered = true;
      depth += 1;
      current = await listDir(session, path);
    }

    const title =
      current.title ||
      info.list?.[0]?.server_filename ||
      current.files[0]?.name ||
      current.folders[0]?.name ||
      parsed.surl;
    const isFolder = current.folders.length > 0;

    return {
      success: true,
      isFolder,
      title,
      path,
      folders: current.folders,
      files: current.files,
      share: metaFromSession(session, title, info.fcount ?? null),
      crumbs: crumbsFor(path),
      autoEntered,
    };
  } catch (err) {
    if (err instanceof ShareError) return failure(err);
    return failure(
      new ShareError(
        "share_unavailable",
        "Could not inspect this public share.",
        err instanceof Error ? err.message : "unknown",
      ),
    );
  }
}

export async function resolveMedia(
  url: string,
  fsId: string,
  password?: string,
  dir?: string,
): Promise<MediaResult> {
  try {
    if (!fsId) {
      throw new ShareError("file_metadata_failed", "Missing file id.");
    }
    const parsed = parseShareUrl(url);
    const { session, info } = await createSession(parsed, password);
    const start = dir && dir !== "/" ? dir : "/";
    const listed = await listDir(session, start);
    let file = listed.files.find((f) => f.id === fsId) ?? null;
    if (!file) {
      const fromInfo = toItems(info.list).find((item) => !item.isDir && item.id === fsId);
      file = fromInfo && !fromInfo.isDir ? fromInfo : null;
    }
    if (!file) {
      file = await findFile(
        session,
        fsId,
        listed.folders.map((f) => f.path),
        0,
      );
    }
    if (!file) {
      throw new ShareError("file_metadata_failed", "That file is not in this public share.");
    }

    const streamUrl =
      file.mediaType === "video" || file.mediaType === "audio" ? await resolveStreamUrl(session, fsId) : null;
    let directUrl: string | null = null;
    try {
      directUrl = await resolveDownloadUrl(session, fsId);
    } catch (err) {
      if (!(err instanceof ShareError)) throw err;
      if (err.code !== "media_resolution_failed" && err.code !== "malformed_upstream") throw err;
    }

    let limitation: string | null = null;
    try {
      limitation = downloadLimitation(directUrl, streamUrl);
    } catch (err) {
      if (err instanceof ShareError) throw err;
      throw err;
    }

    return {
      success: true,
      name: file.name,
      mediaType: file.mediaType,
      size: file.size,
      sizeLabel: file.sizeLabel,
      streamUrl,
      streamKind: streamUrl ? "hls" : null,
      directUrl,
      downloadAvailable: Boolean(directUrl),
      limitation,
    };
  } catch (err) {
    if (err instanceof ShareError) return failure(err);
    return failure(
      new ShareError(
        "media_resolution_failed",
        "Could not resolve media for this file.",
        err instanceof Error ? err.message : "unknown",
      ),
    );
  }
}

async function findFile(
  session: ShareSession,
  fsId: string,
  dirs: string[],
  depth: number,
): Promise<FileItem | null> {
  if (depth > 6) return null;
  for (const dir of dirs) {
    const listed = await listDir(session, dir);
    const hit = listed.files.find((f) => f.id === fsId);
    if (hit) return hit;
    const nested = await findFile(
      session,
      fsId,
      listed.folders.map((f) => f.path),
      depth + 1,
    );
    if (nested) return nested;
  }
  return null;
}

export function proxyAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("terabox.app") ||
      host.endsWith("terabox.com") ||
      host.endsWith("teraboxcdn.com") ||
      host.endsWith("1024tera.com") ||
      host.endsWith("1024terabox.com") ||
      host.endsWith("terabox.co")
    );
  } catch {
    return false;
  }
}
