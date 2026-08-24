export type MediaType = "video" | "audio" | "image" | "archive" | "document" | "file";

export type ErrorCode =
  | "invalid_url"
  | "unsupported_domain"
  | "expired_share"
  | "password_protected"
  | "incorrect_password"
  | "share_unavailable"
  | "folder_listing_failed"
  | "file_metadata_failed"
  | "media_resolution_failed"
  | "security_verification"
  | "upstream_timeout"
  | "upstream_http_error"
  | "malformed_upstream"
  | "empty_share";

export type ShareMeta = {
  surl: string;
  origin: string;
  shareId: string;
  uk: string;
  title: string;
  fileCount: number | null;
};

export type FolderItem = {
  id: string;
  name: string;
  path: string;
  itemCount: number | null;
  isDir: true;
};

export type FileItem = {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeLabel: string;
  mediaType: MediaType;
  isDir: false;
  duration: number | null;
  thumbnail: string | null;
  category: string | null;
};

export type ListingItem = FolderItem | FileItem;

export type Crumb = {
  name: string;
  path: string;
};

export type InspectSuccess = {
  success: true;
  isFolder: boolean;
  title: string;
  path: string;
  folders: FolderItem[];
  files: FileItem[];
  share: ShareMeta;
  crumbs: Crumb[];
  autoEntered: boolean;
};

export type InspectFailure = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
};

export type InspectResult = InspectSuccess | InspectFailure;

export type MediaSuccess = {
  success: true;
  name: string;
  mediaType: MediaType;
  size: number;
  sizeLabel: string;
  streamUrl: string | null;
  streamKind: "hls" | null;
  directUrl: string | null;
  downloadAvailable: boolean;
  limitation: string | null;
};

export type MediaResult = MediaSuccess | InspectFailure;

export type ParsedShareUrl = {
  original: string;
  origin: string;
  host: string;
  surl: string;
  password: string | null;
};

export type ShareSession = {
  origin: string;
  surl: string;
  jsToken: string;
  pcftoken: string;
  cookies: Record<string, string>;
  shareId: string;
  uk: string;
  sign: string;
  timestamp: string;
};

export type UpstreamListItem = {
  fs_id?: string | number;
  server_filename?: string;
  path?: string;
  isdir?: string | number;
  size?: string | number;
  category?: string | number;
  duration?: string | number;
  thumbs?: { url1?: string; url2?: string; url3?: string; icon?: string };
  md5?: string;
  dlink?: string;
};
