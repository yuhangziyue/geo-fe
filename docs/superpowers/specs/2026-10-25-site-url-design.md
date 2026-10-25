# Site URL — Design

> Written before implementation (brainstormed and approved in chat on 2026-10-25). Size: small change.

## Intent

The public site URL feeds JSON-LD `@id`s, canonical links, `metadataBase`, the sitemap, robots.txt and llms.txt.
Today six files each read `process.env.SITE_URL ?? 'http://localhost:3000'`. Make it one validated source.

## Context that shapes the design

The project is only ever run locally (`pnpm dev` / `pnpm demo`); it is not deployed to a public domain.
`pnpm demo` is a production build, so **failing the build when `SITE_URL` is unset would lock reviewers out** —
that is the anti-goal.

## Goals

1. One module owns the value; the localhost default is written once.
2. A `SITE_URL` that *is* set but malformed fails loudly with a message saying what is wrong, instead of silently
   producing broken JSON-LD and sitemap URLs.

## Non-goals

- Deploying anywhere; per-environment config; Next `basePath` / sub-path hosting.

## Behavior

| `SITE_URL` | Result |
|---|---|
| unset or empty | `http://localhost:3000` (matches `pnpm demo`); `next build` and `next start` each print **one** line saying so |
| `https://example.com` or `https://example.com/` | `https://example.com` (trailing slash removed) |
| `http://localhost:3100` | accepted (port allowed) |
| `example.com`, `ftp://…`, `https://example.com/shop`, `https://example.com?x=1`, `…#a` | throws `Error` whose message starts with `SITE_URL` and shows the received value and an example |

## Decisions

- **Origin only (my call):** paths are rejected; supporting a sub-path also needs Next `basePath`, out of scope.
- **Lives in `backend/src/shared/site.ts` (my call):** pure and unit-testable with Vitest; the frontend has no unit
  runner. Exported as `siteUrl(env?: Record<string, string | undefined>): string`, reading `process.env` by default
  so tests pass their own env.
- **Warn, don't fail, when unset in production:** see Context.
- **The notice lives in `next.config.ts`, not in `siteUrl()` (changed during implementation):** `siteUrl()` stays
  pure; `siteUrlNotice(env?)` returns the line or `null`. A warning inside `siteUrl()` printed **9 times** in one
  build (each static-generation worker calls it), and a per-process flag still left **4** (workers reload
  `next.config.ts` too). `next.config.ts` validates once (a bad value fails before compilation starts) and sets
  `GEO_SITE_URL_NOTICE_SHOWN`, which workers inherit → exactly one line, verified by counting in the build log.
- All six call sites use `siteUrl()`; `jsonld.ts` keeps taking the URL as a parameter (unchanged).

## Acceptance criteria

1. No `process.env.SITE_URL` remains outside `site.ts` (`git grep`).
2. Unit tests cover every row of the Behavior table, including the notice (production + unset) and its absence
   (development, or value set). A build with `SITE_URL` unset prints the notice exactly once.
3. `pnpm demo` / `pnpm e2e` work with no `SITE_URL` set; typecheck, lint, unit and e2e stay green.
4. With `SITE_URL=https://example.com/`, the built product page's JSON-LD and the sitemap use `https://example.com`
   with no double slash; with `SITE_URL=example.com` the build fails with the `SITE_URL` message.
