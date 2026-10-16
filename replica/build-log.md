# Build log

Status key: partial = code written, compiles and lints, NOT yet run against a real Supabase project (no keys yet), no screenshots.

| screen | date | status | missing / notes |
| --- | --- | --- | --- |
| shell (header, theme toggle, tokens) | 2026-10-15 | partial | header wraps on mobile, no bottom tab bar yet |
| S05 /login (login + register in one page) | 2026-10-15 | partial | no Google login, no password reset |
| S06 /studio, /studio/[id] (create/edit title, cover, genres, upload chapter, publish, delete) | 2026-10-15 | partial | upload is the riskiest code: untested with real files; no page reordering |
| S03 /title/[slug] | 2026-10-15 | partial | no ratings, comments, related, "add to list" |
| S04 /read/[id] | 2026-10-15 | partial | strip + paged; no fit option; not tested in Android WebView |
| S02 /biblioteca | 2026-10-15 | partial | single genre, no exclude-genres, no author filter, sort newest/A-Z |
| S01 / | 2026-10-15 | partial | pending, latest chapters, new titles |
| S07 /history | 2026-10-15 | partial | last 50 reads |
| S08 /lists, /lists/[id] + add-to-list on title page | 2026-10-15 | partial | tested create, add, view; not tested: public visibility from a second user, delete, remove item |
| S09/S10 /u/[username] (public page + own profile edit) | 2026-10-15 | partial | tested edit username+bio and the works grid; no avatar; anonymous view only checked via API |
| S11 /faq, /normas + footer links | 2026-10-15 | done | text is mine; no contact address (says "ask the admin") |

Harder than expected: the design tokens had a circular CSS variable (`--color-bg: var(--color-bg)`) that would have broken Tailwind; renamed the raw vars to `--c-*`/`--f-*`/`--r-*`/`--sh-*` in replica/design.
Data layer: no fake layer; pages call Supabase directly (see architecture.md). Needs replica/schema.sql then replica/seed.sql run in the Supabase SQL editor, and .env.local from .env.local.example.

## 2026-10-15 flow test (real Supabase, Chrome at 426px wide)
Passed: create title, cover upload, chapter upload (3 pages, WebP), publish, home feed, title page, status "Siguiendo", pending chapters, reader (strip), history, directory list.
Bugs found and fixed: storage upload used `upsert` (needs an UPDATE policy -> RLS error); title page query ambiguous (`profiles!owner_id`); studio page blanked while reloading (lost form); file input not cleared after upload; theme script in <head>.
Not tested: paged reader mode, filters with a value, delete chapter, failure cleanup, second user (reader only), 1440px width, Android WebView, keyboard-only.

## 2026-10-15 visual pass + ZIP import
- New accent (indigo, AA in light and dark, 0 contrast failures), sticky blurred header with active state, bottom tab bar on mobile, cards with hover lift / type badge / initial fallback when no cover, home hero for visitors, covers in the latest-chapters list, blurred-cover banner on the title page, sticky toolbar in the reader, spinner in loading buttons, reduced-motion support.
- Upload form: drag and drop, ZIP import (unpacked in the browser with fflate; ignores folders, __MACOSX, hidden files and non-images; limit 300 images / 300 MB uncompressed), thumbnail grid with page numbers, remove a page, "quitar todo", chapter number guessed from the zip name (last number).
- Tested: `node --test lib/zip.test.ts` (5 pass), playwright suite (16 pass), build and lint clean, home and title page seen at 1482 px with no console errors.
- NOT tested in the browser: the upload form with a real zip (the browser session available was a non-creator account), mobile bottom bar, reader sticky bar, dark/light switch with the new accent, long titles in the new cards.
- shortcut: pages cannot be reordered by dragging; order = file name. Zip with several chapter folders is merged into one chapter.

## 2026-10-15 colours, motion, loaders, warnings, offline
- Palette: soft + solid tones for accent, info, success, warning, danger, pink, teal (light and dark), plus fixed chip colours per type (manga, manhwa, manhua, webtoon, novel, comic, oneshot). 41 contrast pairs, 0 AA failures (checked with Node).
- Labels: type chip on covers, status badge with dot (publishing green, finished blue, paused amber, cancelled red), demography badge (shounen blue, seinen teal, shoujo pink, josei violet, kodomo amber), genres as soft violet chips, draft badges amber.
- Cards: hover lift with accent border, status dot, initial fallback, staggered entrance.
- Motion: page fade-up, stagger on grids and lists, pop on callouts and dialogs, toast slide-in, shimmer skeletons, striped progress bar; all off under prefers-reduced-motion.
- Loaders: shimmer skeletons, spinner in loading buttons, upload progress bar with page counter, page images fade in over a skeleton with reserved aspect ratio, download progress.
- Warnings: Callout (info, success, warning, danger) for drafts, published-without-chapters, large uploads, offline copy; toasts for save/upload/errors; confirm dialog (native <dialog>) replaces window.confirm; offline banner when the connection drops.
- Offline: "Descargar" on the reader and on each chapter row stores all page images in IndexedDB; the reader falls back to the copy when the network fails; /offline lists downloads with size and device storage usage; a service worker (production only) keeps visited pages and build assets so the app opens without a connection.
- Tested: playwright 19 pass (dev 17 + prod offline 2: download, cut the network, reload, read from the copy, downloads page offline, cleanup), lint 0 errors, zip unit tests 5 pass; in Chrome: ZIP upload (3 pages from 6 entries, number guessed), toast, delete with the confirm dialog, coloured badges on cards and title page.
- Limits: offline marks-as-read are skipped without a connection (not queued); an unvisited page offline shows the downloads page; the service worker is not active in `npm run dev`; the APK wrapper has not been built so offline there is untested; light theme and 390 px not re-checked after these changes.

## 2026-10-15 installable app (PWA) + deploy prep
- Added `app/manifest.ts` (standalone, theme and background colours), icons in `public/icons/` (192, 512, maskable 512, apple touch; drawn here), theme colour and apple web app metadata. e2e test checks the manifest and that every icon is served. The service worker already existed (production only).
- NOT done: deploy and APK. Vercel CLI is installed but logged out (`vercel login` is interactive). No Android SDK on this machine (Java 27 present), so a Capacitor APK cannot be built locally without installing Android Studio.
- Plan: 1) `vercel login`, 2) set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel, 3) `vercel --prod`, 4) install from Chrome on Android ("Instalar app") or generate a signed .apk from the deployed URL with PWABuilder.
- Tests no longer depend on one specific title (`e2e/data.ts` finds any published chapter with pages; they skip, saying why, if there is none). The offline test now runs against a real 91-page chapter. 20 pass.

## 2026-10-15 deployed
- Live at https://readerblox.vercel.app (Vercel hobby, project `readerblox`, account `2023030519-4034`). Env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (role anon, checked) set for Production and Preview. `.vercelignore` keeps replica/, e2e/, test results and .env.local out of the upload. Redeploy: `npx vercel --prod --yes`.
- Verified on the live URL: /, manifest, sw.js, icon, /offline, /faq all 200; the full suite (20 tests, incl. offline with a real 91-page chapter over HTTPS and the service worker) passes with `BASE_URL=https://readerblox.vercel.app npx playwright test`.
- Not done: the .apk file. Install now from Chrome on Android (menu > Instalar app); a signed .apk can be generated from the live URL with PWABuilder.
- Open: anyone with the URL can create a reader account; nothing in Supabase Auth settings was changed.
