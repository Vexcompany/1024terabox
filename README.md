# 1024 Share

A research-first public-share explorer for 1024TeraBox / TeraBox-compatible public links.

Paste a public share URL, inspect the real folder tree, then resolve a playable URL only for the file you select.

## What this is not

This is not a clone of [1024teradl.com](https://1024teradl.com/). That site’s Cloudflare “security verification” / CAPTCHA belongs to the third-party website, not to TeraBox’s public-share API. This project does not copy ads, waiting pages, tracking, or CAPTCHA solving.

## Confirmed public-share flow

Observed against TeraBox’s own web player (`www.terabox.app` / `www.1024tera.com`) with Playwright + live HTTP:

```text
Public share URL
      ↓  GET /sharing/link?surl=…
Share page HTML (jsToken, pcftoken, browserid cookie)
      ↓  GET /api/shorturlinfo?shorturl=1{surl}&root=1
Share metadata (shareid, uk, sign, timestamp, errno)
      ↓  GET /share/list?shorturl={surl}&root=1|dir=…
Current-folder listing (files + folders only)
      ↓  user selects a video
GET /share/streaming  (HMAC-SHA1 over clienttype+channel+browserid+timestamp)
```

`1024terabox.com/s/1{id}` redirects to `www.terabox.app/sharing/link?surl={id}`.
`www.1024terabox.com/s/1{id}` redirects to `www.1024tera.com/sharing/link?surl={id}`.

### Endpoints (web, unauthenticated)

| Stage | Method | Path | Notes |
| --- | --- | --- | --- |
| Page | GET | `/sharing/link?surl=` | Sets `csrfToken`, `browserid`, `TSID`. Embeds `jsToken`. |
| Metadata | GET | `/api/shorturlinfo` | `shorturl` **with** leading `1`. |
| Listing | GET | `/share/list` | `shorturl` **without** leading `1`. `root=1` or `dir=/path&root=0`. |
| Password | POST | `/share/verify` | `pwd`. errno `-9` if still locked. |
| Stream | GET | `/share/streaming` | Public player HMAC. Returns HLS. |
| Download | POST | `/share/download` | Often errno `2` without a TeraBox login. Reported as a limitation. |

HTTP 200 is not success. The JSON `errno` field is the semantic result.

### errno (observed)

| errno | Meaning |
| --- | --- |
| 0 | Success |
| -4 / 116 | Deleted / not found |
| -9 | Password-protected |
| 2 | Invalid parameters |
| 130 | Requested stream quality unavailable |
| 4000020 / 400141 | Security verification |

The sample `https://1024terabox.com/s/1qwJxYQ8hWfs1Sm7JeNrC6w` is deleted on TeraBox itself (`errno -4`, official UI: “Sorry, this content has been deleted”).

## Folder rules

- Multiple folders → show folders
- Exactly one folder and no files → enter it
- Files present → show files (and folders if mixed)
- Never flatten the whole share

Media URLs are resolved lazily when a file is clicked.

## Security

- Public shares only
- No account cookies, no CAPTCHA solving, no private file access
- Temporary page tokens stay on the server and are not logged
- Stream proxy only allows TeraBox CDN / share hosts

## Development

```sh
npm run dev
npm test
npm run typecheck
npm run build
```
