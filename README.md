# 1024terabox

A research-first public-share extractor for 1024TeraBox / TeraBox-compatible public links.

## Goal

Build a clean extractor that can inspect public shares, preserve folder structure, list files, and resolve a selected media/download URL when the public-share flow legitimately exposes one.

The project is intentionally designed to avoid advertising/interstitial dependencies. A reference service may use ads or waiting pages; those are not part of this project's architecture.

## Reference material

- Reference service: https://1024teradl.com/
- Sample public share: https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w

The reference service currently presents a CAPTCHA/security-verification step in some flows. That behavior must be documented and respected rather than blindly copied or defeated.

## Architecture

```text
Public share URL
      ↓
Share metadata
      ↓
Root listing
      ↓
Folder navigation
      ↓
File metadata
      ↓
Selected-file media/download resolution
```

Media URLs should be resolved lazily. Initial discovery should not attempt to resolve every video in a large folder.

## Folder behavior

- Multiple folders at the current level → show the folders.
- Exactly one folder and no files → automatically enter it.
- Files at the current level → show the files.
- Nested folders → preserve the hierarchy.

## Security and limitations

Only public-share resources that are legitimately accessible without account authentication should be handled.

Do not:

- expose cookies, credentials, or private session data;
- commit secrets;
- bypass account authentication;
- solve or defeat CAPTCHA/security verification;
- reproduce ad redirects, forced waiting pages, or tracking mechanisms.

If a public share requires a CAPTCHA or other security verification, return a clear limitation/error instead of attempting to circumvent it.

## Development principles

Research the actual browser/network flow before implementing undocumented endpoints. Do not guess endpoint names repeatedly. Validate response schemas, keep modules small, and run the build/typecheck before committing.

See [GROK.md](./GROK.md) for the implementation/research instructions for Grok.
