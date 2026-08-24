import type { ErrorCode } from "./types.ts";

export class ShareError extends Error {
  readonly code: ErrorCode;
  readonly details?: string;
  readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, details?: string, httpStatus = 400) {
    super(message);
    this.name = "ShareError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

export function failure(error: ShareError | { code: ErrorCode; message: string; details?: string }) {
  return {
    success: false as const,
    error: {
      code: error.code,
      message: error.message,
      details: "details" in error ? error.details : undefined,
    },
  };
}

const ERRNO_MAP: Record<string, { code: ErrorCode; message: string }> = {
  "0": { code: "share_unavailable", message: "Unexpected empty success payload." },
  "-1": { code: "media_resolution_failed", message: "TeraBox refused this download request." },
  "-4": { code: "expired_share", message: "This public share has been deleted or is no longer available." },
  "-6": { code: "share_unavailable", message: "TeraBox rejected the request because no account session is present." },
  "-9": { code: "password_protected", message: "This share is password-protected." },
  "2": { code: "malformed_upstream", message: "TeraBox rejected the request as invalid." },
  "112": { code: "media_resolution_failed", message: "The temporary share signature expired. Retry the listing." },
  "113": { code: "media_resolution_failed", message: "The temporary share signature expired. Retry the listing." },
  "116": { code: "expired_share", message: "TeraBox could not find this share." },
  "118": { code: "share_unavailable", message: "You do not have permission to access this public share." },
  "121": { code: "folder_listing_failed", message: "Too many files were requested at once." },
  "130": { code: "media_resolution_failed", message: "That playback quality is not available for this file." },
  "4000020": { code: "security_verification", message: "TeraBox requires security verification for this share." },
  "400141": { code: "security_verification", message: "TeraBox requires security verification for this share." },
};

export function mapErrno(errno: unknown, fallback: ErrorCode, fallbackMessage: string): ShareError {
  const key = String(errno ?? "");
  const mapped = ERRNO_MAP[key];
  if (mapped) {
    return new ShareError(mapped.code, mapped.message, `errno=${key}`);
  }
  return new ShareError(fallback, fallbackMessage, `errno=${key}`);
}

export function isPasswordErrno(errno: unknown): boolean {
  return Number(errno) === -9;
}

export function isDeletedErrno(errno: unknown): boolean {
  const n = Number(errno);
  return n === -4 || n === 116;
}

export function isVerificationErrno(errno: unknown): boolean {
  const n = Number(errno);
  return n === 4000020 || n === 400141;
}
