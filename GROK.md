# GROK.md — 1024terabox

You are the primary research and implementation agent for this repository.

## Mission

Build a reliable public-share extractor for 1024TeraBox / TeraBox-compatible public links.

The project should work from legitimate public-share data and should not depend on advertisements, forced waiting pages, or third-party interstitials.

## Research first — do not guess

Before implementing undocumented APIs, inspect the actual browser/network behavior.

Reference service:

https://1024teradl.com/

Sample share:

https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w

The reference service is useful for understanding behavior and request flow. It may show advertisements and CAPTCHA/security verification. Do not copy its ad system and do not attempt to defeat CAPTCHA/security controls.

Investigate the real public-share flow:

1. Request made when a share URL is submitted.
2. HTTP method.
3. Endpoint/host.
4. Query parameters.
5. Request body.
6. Required headers.
7. Cookies and non-sensitive browser state.
8. Share identifiers.
9. Folder identifiers.
10. File identifiers.
11. Pagination.
12. Nested-folder requests.
13. File metadata requests.
14. Media/download URL resolution.
15. Temporary/signed URL behavior.
16. Error and security-verification responses.
17. Whether the reference service calls another backend/API.

Do not assume the HTML page contains the final media URL.

## CAPTCHA and anti-bot rules

The reference service can present CAPTCHA/security verification.

DO NOT:

- solve CAPTCHA;
- automate CAPTCHA challenges;
- bypass anti-bot/security verification;
- steal or reuse private authentication cookies;
- access private files/accounts.

If the official/public flow requires a security challenge, detect it and return/document a clear limitation.

## Desired architecture

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
Selected file
      ↓
Media/download URL resolution
```

Keep discovery separate from media resolution.

Do NOT resolve hundreds of media URLs during initial listing.

## Folder behavior

At every directory level:

- Multiple folders → return/show folders.
- Exactly one folder and no files → automatically enter that folder.
- Files → return/show files.
- Mixed folders and files → preserve both; do not flatten the tree.
- Nested folders → preserve their hierarchy.

The frontend should be able to navigate folders without resolving every file URL first.

## Lazy media resolution

When the user selects a file/video:

```text
file metadata
   ↓
resolve selected file
   ↓
temporary playable/download URL
```

Do not pre-resolve all files.

## Error handling

Distinguish at least:

- invalid URL;
- unsupported domain;
- expired/unavailable share;
- password-protected share;
- CAPTCHA/security verification required;
- share metadata failure;
- folder listing failure;
- file metadata failure;
- media URL resolution failure;
- upstream timeout/error.

Never convert every HTTP 200 response into success. Validate the response schema and semantic result.

Avoid vague errors such as only `Extraction failed` when a more useful reason is available.

## Logging

Production logs must not contain:

- passwords;
- cookies;
- account credentials;
- private authorization headers;
- reusable private session tokens.

When debugging API responses, log only safe structural information such as status/code, object keys, and list counts.

## Testing

Use the supplied sample during development:

https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w

Test at minimum:

- valid public share;
- single-file share;
- folder share;
- nested folder;
- multiple folders;
- non-video file;
- invalid URL;
- security-verification response.

Before every implementation commit:

- run `npm run build`;
- run lint if configured;
- verify TypeScript types;
- do not leave known build errors.

## Implementation discipline

- Inspect the existing repository before changing it.
- Do not rewrite unrelated files.
- Do not create speculative endpoint variants without evidence.
- Prefer small modules for parsing, share discovery, listing, media resolution, and errors.
- Document important discoveries in README.md.
- Keep the API contract explicit.

## Reference service vs our project

`1024teradl.com` is a research/reference target, not a dependency.

Its advertisements, redirects, waiting screens, analytics, and CAPTCHA pages must not become part of this project.

The goal is to reproduce legitimate public-share data retrieval where technically and legally appropriate, not to reproduce the reference site's monetization or security-bypass behavior.

## Final workflow

Research → observe network behavior → reproduce one confirmed request → validate response → implement → typecheck/build → test sample → commit.

Do not skip the research stage merely because an endpoint name looks obvious.
