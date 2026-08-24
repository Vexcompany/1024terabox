import { itemId, itemName, itemPath, isDirItem, mediaTypeOf, pickThumbnail, formatSize } from "./format.ts";
import type { FileItem, FolderItem, ListingItem, UpstreamListItem } from "./types.ts";

const AUTO_ENTER_MAX_DEPTH = 8;

export function toListingItem(raw: UpstreamListItem): ListingItem | null {
  const id = itemId(raw);
  const name = itemName(raw);
  if (!id || !name) return null;
  if (isDirItem(raw)) {
    return {
      id,
      name,
      path: itemPath(raw),
      itemCount: null,
      isDir: true,
    };
  }
  const size = Number(raw.size ?? 0) || 0;
  return {
    id,
    name,
    path: itemPath(raw),
    size,
    sizeLabel: formatSize(size),
    mediaType: mediaTypeOf(name, raw.category),
    isDir: false,
    duration: raw.duration != null ? Number(raw.duration) || null : null,
    thumbnail: pickThumbnail(raw),
    category: raw.category != null ? String(raw.category) : null,
  };
}

export function splitListing(items: ListingItem[]): { folders: FolderItem[]; files: FileItem[] } {
  const folders: FolderItem[] = [];
  const files: FileItem[] = [];
  for (const item of items) {
    if (item.isDir) folders.push(item);
    else files.push(item);
  }
  return { folders, files };
}

/**
 * If the current level is a single folder with no files, enter it.
 * Stops when files appear, multiple folders appear, or the folder is empty.
 */
export function shouldAutoEnter(folders: FolderItem[], files: FileItem[]): FolderItem | null {
  if (folders.length === 1 && files.length === 0) return folders[0];
  return null;
}

export function autoEnterPath(
  startPath: string,
  resolve: (path: string) => { folders: FolderItem[]; files: FileItem[] },
): { path: string; folders: FolderItem[]; files: FileItem[]; autoEntered: boolean } {
  let path = startPath;
  let { folders, files } = resolve(path);
  let autoEntered = false;
  let depth = 0;
  while (depth < AUTO_ENTER_MAX_DEPTH) {
    const next = shouldAutoEnter(folders, files);
    if (!next) break;
    path = next.path;
    autoEntered = true;
    depth += 1;
    ({ folders, files } = resolve(path));
  }
  return { path, folders, files, autoEntered };
}
