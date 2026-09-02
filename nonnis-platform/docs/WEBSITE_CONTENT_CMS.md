# Public Website Content CMS

Nonnis staff manage the public marketing website's blog, short videos, and
testimonials from the internal CRM. The public website reads that content from
the platform's public API and its media from Supabase Storage.

## 1. Public content API environment

The public website fetches content **server-side** from the platform backend.

- `NONNIS_PLATFORM_API_URL` (server-only, root website `.env`): base URL of the
  NestJS backend. It is the same variable used by form-submission ingestion.
  It may include or omit a trailing slash and/or an `/api/v1` suffix — the
  website normalizes it (see `src/lib/platform/platform-url.ts`) so a request is
  never built as `/api/v1/api/v1/...`.
- No browser token is involved: the public endpoints (`/api/v1/public/...`) are
  unauthenticated and read-only.

## 2. Development API fallback

In **development** (`NODE_ENV !== "production"`), if `NONNIS_PLATFORM_API_URL` is
unset the website falls back to `http://localhost:4000` (the local backend), so
the site works out of the box. In **production** the variable is **REQUIRED** —
there is no localhost fallback; content simply stays hidden if it is missing.

During development, content-fetch failures are logged with safe diagnostics
(endpoint, HTTP status, category) — an empty page is never silently mistaken for
"no CMS content". Secrets are never logged.

## 3. Supabase Storage bucket

All CMS media lives in one public-read bucket: **`nonnis-content`**. It is
created idempotently by the backend (`MediaService.onModuleInit` /
`ensureBucket`) and by the media seed. Public read is enabled; writes/deletes
require the backend service-role key (never exposed to the browser).

## 4. Storage folder structure

```
nonnis-content/
  blog/featured/<uuid>.<ext>     # blog featured images
  videos/<uuid>.<ext>            # short-form videos
  videos/posters/<uuid>.<ext>    # video poster/thumbnail images
```

Object paths are always generated server-side from a UUID — raw user filenames
are never trusted as paths.

## 5. Image rules

Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
Maximum size: **10 MB** (enforced in `MediaService.validate`).

## 6. Video rules

Allowed MIME: `video/mp4`, `video/webm`.
Maximum size: **250 MB** (application-level). NOTE: the Supabase project's
**global** file-size limit must be ≥ the largest video you upload — raise it in
the Supabase dashboard for large client videos. The bucket itself carries no
per-bucket limit (a per-bucket limit may not exceed the project global limit).

## 7. Upload architecture

Large files never pass through the Nest backend:

1. Admin browser → `POST /api/v1/content/media/upload-url` (requires
   `content.manage`; validates kind + MIME + size).
2. Backend mints a short-lived **Supabase signed upload URL** and returns
   `{ path, token, signedUrl, publicUrl }`.
3. Browser uploads the file **directly** to Supabase Storage (with progress).
4. The content record stores the resulting public URL **and** the managed
   storage path (`featuredImageStoragePath` / `videoStoragePath` /
   `posterImageStoragePath`) for safe replacement/deletion.

The service-role key stays backend-only.

## 8. Media replacement / deletion behavior

- **Replace/remove in the editor:** an unsaved just-uploaded object is deleted
  immediately (`DELETE /api/v1/content/media`); server-persisted media is left
  to save-time cleanup.
- **On save:** when a record's storage path changes or clears, the backend
  best-effort deletes the previous managed object *after* the DB update succeeds.
- **On record delete:** the record's owned managed objects are removed.
- Only objects inside the managed bucket folders are ever deleted. External URLs
  (storage path `null`) are never touched.

## 9. Demo media seed command

```
cd nonnis-platform/backend
npm run content:seed-media
```

Idempotent: uploads the real existing demo assets from the website's
`public/assets/...` to Supabase (stable object paths, `upsert`), then rewrites
the seeded blog/video demo records to point at the Supabase public URLs +
storage paths. Missing source files are reported and skipped, never invented.
The base RBAC seed (`npm run prisma:seed`) never clobbers these media URLs on
re-run (its `update` clauses omit the media fields).

## 10. Rich editor shortcuts

The blog body uses a selection-aware Markdown editor
(`src/features/content/MarkdownEditor.tsx`, commands in `src/lib/markdown-commands.ts`):

| Shortcut (Mac / Win-Linux)        | Action        |
| --------------------------------- | ------------- |
| ⌘/Ctrl + B                        | Bold          |
| ⌘/Ctrl + I                        | Italic        |
| ⌘/Ctrl + K                        | Link          |
| ⌘/Ctrl + Z                        | Undo          |
| ⌘/Ctrl + Shift + Z  (or Ctrl + Y) | Redo          |
| ⌘/Ctrl + Alt + 1…6                | Heading 1…6   |

Toolbar: undo/redo, heading dropdown (Paragraph, H1–H6), bold, italic, inline
code, bullet list, numbered list, blockquote, link, horizontal rule, clear
formatting, plus Write / Split / Preview tabs and live word/char count. The
preview uses the same Markdown parsing rules as the public blog detail page.

## 11. Cache / revalidation behavior

Public content pages use ISR with `revalidate = 30` seconds, so an admin's
publish/edit appears on the website within ~30s without a redeploy. If a fetch
fails, the page keeps its last good render rather than caching an empty result.

## 12. Production environment required

- `NONNIS_PLATFORM_API_URL` — required on the website (no dev fallback in prod).
- Backend: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (already configured for
  auth) power storage; the service-role key must remain backend-only.
- Both Next apps allow Supabase Storage images narrowly via `images.remotePatterns`
  (`*.supabase.co`, path `/storage/v1/object/public/**`).
- `NEXT_PUBLIC_SITE_URL` — canonical public origin, single source of truth in
  `src/lib/site-url.ts` and consumed by `layout.tsx` / `sitemap.ts` / `robots.ts`.
  Confirm the exact live host (apex vs. `www`) before launch.

## 13. Runtime smoke test

```
# with the website (and backend) running:
npm run test:smoke          # from the repo root
```

`scripts/smoke-public-content.mjs` HTTP-requests the rendered `/blog` and `/`
pages and asserts seeded blog titles, the Short Videos heading, Supabase-hosted
media, and seeded testimonials are present — catching the "public page renders
but is empty" class of regression that a build check cannot.

## 14. Short-video rail interaction

The public `/blog` short-video section (`src/components/blog/ShortVideoStrip.tsx`,
timing logic in `src/components/blog/carousel.ts`) is a **full-bleed** horizontal
wall of large 9:16 portrait panels (≈22–28vw desktop; one dominant ≈86vw card with
a peek on mobile).

- **Inline autoplay:** each visible/near-visible panel autoplays its video
  **muted + looped + `playsInline`**, gated by an IntersectionObserver so offscreen
  panels only fetch poster + metadata (`preload="metadata"`) — never a full download.
  Audio only plays after an explicit click opens the lightbox.
- **Auto-scroll:** the rail advances ~every 2.5s and loops seamlessly (duplicated
  set + forward wrap). It pauses on hover, drag/swipe, an open lightbox, a hidden
  tab, and `prefers-reduced-motion`; it resumes ~5s after manual interaction.
  Reduced-motion also pauses inline autoplay and disables auto-advance (manual
  scroll/swipe still works). Scroll-snap gives polished manual settling.
- **Lightbox:** clicking a panel opens the controlled player (full controls, audio
  allowed, one video at a time, Escape/backdrop close, focus managed, body scroll
  paused). The pure timing rules are unit-tested in `carousel.test.ts`.
