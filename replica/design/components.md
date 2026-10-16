# Components: readerblox

Own design, no assets from ZonaTMO. Icons: Lucide (MIT). Font: Inter (open). Base: shadcn/ui (Radix) so keyboard and screen-reader behaviour comes for free.
Sized for a private project: about 20–30 users, friends as authors. Components that only the original's scale needed (rankings tabs, top groups, share buttons, 6-way reactions) are cut; see the end.

Global: all colours from tokens (`bg-surface text-muted`, never hex). Focus-visible = 2px ring in `accent`, offset 2. Touch targets at least 44px on mobile (APK). Light/dark follows the system, toggle sets `data-theme`.

```
Button
  variants  primary (accent), secondary (surface+border), ghost, danger
  sizes     sm 32, md 40, lg 48
  states    default, hover, active, focus-visible, disabled, loading (label kept for screen readers, aria-busy)
  a11y      real <button>; icon-only needs aria-label
  used on   S01–S10

Input / Textarea / Select
  states    default, focus, error (danger border + message tied by aria-describedby), disabled
  tokens    border-field (3:1), radius md, text sm/base
  used on   S02 filters, S05, S06, title form

TitleCard
  parts     cover (2:3, lazy, alt = title), title (2 lines, ellipsis), type badge, status + chapter count, score (hidden when no votes, not "0.00")
  states    default, hover (shadow-card), focus-visible, cover-missing (surface + icon)
  grid      2 / 3 / 4 / 5 columns (base/sm/md/lg)
  used on   S01, S02, S03 related, S08

FilterPanel (S02)
  fields    type, demography, status (selects); genres + exclude genres (multi-chip); author (text)
  mobile    collapses into a bottom sheet with "Apply"
  states    default, active-count badge, no-results empty state ("Nothing matches. Clear filters")
  sort      select + asc/desc toggle

Pagination
  prev / next + "page N of M" (original only has prev/next); disabled at ends; aria-label="Pagination"

Badge
  variants  type, status, demography, draft (creator view)

StatusPicker (S03)  — 6 library statuses + favorite
  Radix dropdown/select; shows current status; logged out -> opens login prompt, returns to title
  states    unset, set, saving, error (toast)

ChapterRow (S03)
  parts     number (decimals ok), name, relative time, read checkbox, link to reader
  states    unread (bold), read (muted), draft (creator only, badge)
  bulk      "Mark all read / unmark all" above the list
  a11y      checkbox labelled "Mark chapter 12 as read"; whole row link, checkbox separate

Reader (S04)
  modes     vertical strip (default, webtoon) and paged (left/right)
  controls  mode, fit width, prev/next chapter, chapter select; bar auto-hides on tap, always reachable by keyboard
  states    loading (page skeleton, fixed aspect to avoid layout jump), page error (retry button), end of chapter (next-chapter card), no pages (empty)
  perf      lazy-load, preload next 2 images; max width 800
  a11y      keys: ←/→ paged, space/PgDn scroll, Esc shows bar

Modal / Sheet (Radix Dialog)
  used for   report (S12), delete confirm, login prompt. Focus trap, Esc closes, focus returns to trigger

Toast
  success/error, 4s, aria-live polite

Expander ("Ver más")
  button with aria-expanded; synopsis clamp 4 lines

Header / Nav
  logo, Library, Lists, search icon, theme toggle, account menu; 56px; mobile = bottom tab bar (Home, Library, My library, Account)

CommentThread (could)
  flat + one reply level; like only (not 6 reactions); delete own

UploadForm (S06)
  drag-drop + file picker, JPG/PNG/WebP only, per-file progress, reorder, remove, total size counter; states idle, uploading, failed (retry), done
  a11y      drop zone is also a keyboard-operable button

ListCard / ListEditor (should)
  name, public toggle, item count, follow button

EmptyState
  icon + one line + action. Needed for: no titles yet (new site!), no pending chapters, no results, empty library, no chapters
```

## Cut for 20–30 users (not built)
Top Scans / group rankings, "Hoy recomendamos", recruitment board, share buttons, six reactions, view-count rankings, recent-uploads carousels by demography. Home = latest chapters + "Continue reading" + new titles.

## Checks
Contrast: 20 pairs (10 light + 10 dark) at AA, 0 failures (ran with Node, no Python here). Primitives are specified, not built yet: they get built with the first screens in /replica-build, inside the vertical slice.
