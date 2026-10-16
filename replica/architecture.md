# Architecture: readerblox (low-user version)

Personal project. About 20–30 users, authors are friends, own works only. Web + Android APK (sideloaded, not on Play).
Replaces the earlier "public site" plan. Everything built for strangers or scale was removed.

## 1. Stack
| layer | choice | why |
| --- | --- | --- |
| web app | Next.js (App Router) + TypeScript | one codebase; SSR for title pages |
| styling | Tailwind + `replica/design/tailwind.css` | tokens already made |
| Android APK | Capacitor, pointing at the deployed site URL | no separate app; update the site and the APK updates. Sideload the APK to friends, no Play Store review |
| database + auth + files | Supabase free tier (Postgres, Auth, Storage) | one service, free at this size |
| data access | Supabase client + RLS | access rules live in the database, no API layer |
| auth | Supabase Auth, email + password, **email confirmation off** | free-tier email is rate-limited; friends only. Optional Google login |
| hosting | Vercel hobby | free |
Cut: CDN, `sharp` image server, Resend, cron jobs, Drizzle, payments, admin app, search engine.

## 2. Schema
`replica/schema.sql`: **12 tables + 1 view** (`title_stats`), RLS on all.
- Removed vs the public plan: `reports`, `comment_reactions`, `list_follows`, `titles.views`, `bump_views`, `is_banned`, most indexes.
- **Creators:** `profiles.is_creator`, set by you in the Supabase dashboard (one click). Only creators can create titles or upload. Users cannot edit that column (column-level grant).
- **Profile on signup:** trigger `handle_new_user` makes the profile with a placeholder username.
- **Files:** one public bucket `media`; storage policy lets creators write only under their own `<uid>/` folder.
- Access rules: **Postgres RLS**. Drafts visible only to their creator; library, reads private to each user; lists visible when public.
- Pending chapters, no table: published chapters of titles the user is "following" with no `chapter_reads` row.
- Hard constraints: `unique(title_id, number)`, `unique(chapter_id, position)`.

## 3. Routes
| path | does | who |
| --- | --- | --- |
| / | continue reading, pending chapters, latest chapters, new titles | anyone (personal parts need login) |
| /biblioteca?type&demography&status&genre&q&sort&page | directory; filters run as one Supabase query (`ilike` for search) | anyone |
| /library/[type]/[id]/[slug] | title page, chapter list, status picker, rating, comments | anyone |
| /read/[chapterId] | reader; marks chapter read if logged in | anyone |
| /history | read history | user |
| /lists, /lists/[id] | my lists, public lists | user / anyone |
| /u/[username] | creator page with their titles | anyone |
| /login, /register | auth | anyone |
| /studio, /studio/titles/[id], /studio/titles/[id]/upload | creator: create/edit title, upload chapter, edit/delete | creator |
| /faq, /normas | static, 1 page | anyone |
No separate API routes: pages call Supabase directly (RLS protects). Only server work is data fetching in server components.

## 4. Upload (the one piece of real logic)
Browser-side: pick images, check type by `file.type`, resize to max width 1600 and convert to WebP with `canvas`, upload each file straight to Storage at `<uid>/<titleId>/<chapterId>/<n>.webp`, then insert `chapters` + `pages` rows. Then set `is_published`.
Why client-side: Vercel's body limit (4.5 MB) would block a server upload, and it needs no `sharp`.
Failure: if any upload fails, delete the chapter row and the files already sent, and show retry.

## 5. The parts that bite (reduced)
- **Free-tier storage 1 GB:** this is the real limit. A chapter at ~60 WebP pages is ~10–15 MB, so ~70–100 chapters total. Keep width 1600 and quality ~0.8; watch the Storage usage page. Upgrade (or Cloudflare R2) when it fills.
- **Supabase free pauses after 7 days of no activity:** the site goes down until you unpause. A weekly visit avoids it; Pro fixes it.
- **Reader on Android WebView:** lazy-load and preload next 2 images; strips are long. Test on a real phone.
- **Public bucket:** unpublished images are fetchable by anyone with the exact path (uuid, unguessable). Accepted for friends; marked as a `shortcut:` in the SQL.
- **Moderation:** none built. Only creators you approve can upload; you delete bad rows in the dashboard. Add a report button if strangers ever get in.
- **Open signups:** anyone who finds the URL can create a reader account (cannot upload). If that bothers you, turn off signups in Supabase and create accounts by hand.
- **Legal:** your friends' own works only. If anyone uploads work they don't own, that's on the hosting; keep the "own work only" rule in /normas.
- **Races:** duplicate chapter number is blocked by the unique constraint; show "chapter already exists".
- **Time:** all `timestamptz`.

## 6. Build order
1. **Vertical slice:** register -> you mark yourself creator -> create title -> upload a chapter -> read it. Screens S05, S06, S03, S04. Tables: profiles, titles, chapters, pages, storage.
2. **Must-haves:** S01 home, S02 directory + filters, library statuses + pending (library_entries, chapter_reads), creator edit/delete, static pages, Capacitor APK.
3. **Should-haves:** history, lists, ratings, dark-mode toggle, mark-all-read.
4. **Could:** comments, related titles.
Not planned: reports, rankings, shares, reactions, adult content, Play Store release.
