# Recon map: ZonaTMO (zonatmo.org) → readerblox

Date: 2026-10-15. Method: public pages only, read via fetch, no login, no scraping.

## 1. Scope
- Platform: web + Android APK (wrap the responsive web app, e.g. Capacitor/TWA; decide in /replica-architect).
- Slice: core loop = browse/search → title page → chapter reader → status/library/lists → resume.
- Audience: anyone. Content: **original works published by their own creators** (not scanlations).
- Consequence: ZonaTMO's "groups of translators" become **creators/authors** who upload their own work. No licensed catalogue needed.

## 2. Sources
| source | URL | used for |
| --- | --- | --- |
| home | https://zonatmo.org/ | sections, nav, URL patterns |
| directory | https://zonatmo.org/biblioteca | filters, sorts, cards, pagination |
| title page | https://zonatmo.org/library/manhwa/178/jinx-p1 | title page, chapter list, comments |
| FAQ | https://zonatmo.org/faq | follow states, upload rules |
| guide | https://zonatmo.org/guia | account, lists, groups, upload flow |
| NOT read | /view_uploads/{id} (reader), /login, /subir, /historial, /groups, /lists | reader and account screens are UNVERIFIED; need the user's own account + screenshots |

## 3. Screen inventory
| ID | screen | route | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home | / | discovery + resume | popular/trending carousels (tabbed by demography), my-pending tabs, latest titles, latest chapters feed, weekly/monthly ranking, top groups, featured lists, "today we recommend", dark-mode toggle | logged-out (promo card to login); logged-in not seen |
| S02 | Library / directory | /biblioteca?page=N | find titles | filter panel (type, demography, status, author, genres, exclude genres, +15/+18/+19 quick), search (title/author/company), sort w/ ASC/DESC, card grid 20/page, prev/next | filled; score 0.00 and blank lines for sparse data; empty/error not seen |
| S03 | Title page | /library/{type}/{id}/{slug} | read info, pick chapter | cover, type badge, score+votes, meta (chapters, year, views, demography), synopsis expander, genre tags, status, synonyms, author, share, add-to-list, report, status counters, chapter list, staff, comments, related grid | adult-content modal; logged-out (login prompts); multi-version chapters |
| S04 | Chapter reader | /view_uploads/{id} | read | UNVERIFIED. Marks chapter seen on open (per guide) | not seen |
| S05 | Login / Register | /login, /register | auth | forms | not seen |
| S06 | Upload chapter | /subir | creator publishes | file picker (JPG/PNG/WebP only), choose work, comments | not seen; rules from FAQ |
| S07 | History | /historial | resume | UNVERIFIED | not seen |
| S08 | Lists index + list detail | /lists, /lists/{id}/{slug} | curated lists | trending/most-followed tabs, follower button, public/private | index only seen on home |
| S09 | Groups index + group page | /groups, /groups/{id}/{slug} | creators/teams | tabs: followers, projects, recent uploads; social links; members; status Activo/Abandonado/Finalizado | not seen |
| S10 | Profile | (route unknown) | my library | works by status, my lists, my uploads, public/private | not seen |
| S11 | Static pages | /faq, /guia, /normas, terms, privacy, cookies, contact | info | text | seen |
| S12 | Report modal | on S03 | moderation | reasons: wrong info, duplicate, spam/inappropriate, other | seen |

## 4. Flows
```
F01 Find and read
    S01 or S02 -> S03 -> S04   (home/directory -> title -> reader)       happy path: 3 clicks
    edge: adult title modal, title with no chapters, multiple versions of one chapter, decimal chapters (53.1)
F02 Follow a title
    S03 -> pick status (Siguiendo/Pendiente/Leído/Lo quiero/Lo tengo/Abandonado)  [login required -> S05]
    edge: logged out -> login prompt, return to title
F03 Resume / pending chapters
    S01 "Mis capítulos pendientes" -> S04.  Opening reader auto-marks seen. Pending shows only for works with a status AND in a list
F04 Search/filter
    S02: type + demography + status + genres/exclude + author + sort -> grid -> next page
    edge: no results (state not seen, design one)
F05 Mark read in bulk
    S03: "Marcar todos"/"Desmarcar todos" or per-row checkbox
F06 Make a list
    S03 or S10 -> create list (public/private) -> others follow it from S08
F07 Creator publishes
    register -> create/join a group (S09) -> S03 "Subir capítulo" (work preselected) or group panel -> S06 -> chapter appears in S01 latest feed
    edge: only JPG/PNG/WebP; no watermarks/links; creator can edit/delete anytime
F08 Report a title
    S03 -> S12
```

## 5. Components
Title card (cover, title, type badge, score, +18 badge, status+chapter count, demography), carousel with tabs, filter panel (select, text, multi-chip genres), sort control with direction, pagination (prev/next only), status counters, chapter row (number, age, "read online", uploader, date, version count, checkbox), expander ("Ver más"), modal (adult warning, report), comment thread with 6 reactions, share buttons, dark-mode toggle, tabbed rankings, list card (count of works, followers), group card.

## 6. Inferred data model
- User: id, name, avatar, is_public — evidence: guide, profile. confidence: high
- Title (work): id, slug, type (manga|manhwa|manhua|webtoon|novel|comic|oneshot|doujinshi|oel), demography, status (publishing|finished|paused|cancelled), synopsis, cover, year, synonyms[], is_adult, score_avg, votes, views — evidence: S02/S03. high
- Genre + title_genre — high. Author/Staff + role — medium
- Group (creator team): id, name, status (active|abandoned|finished), socials, members, followers — high
- Chapter: id, title_id, number (decimal), created_at — high. ChapterVersion (upload): id, chapter_id, group_id, uploader, pages[], created_at — high ("2 versiones")
- Page: image url, order — medium
- LibraryEntry: user_id, title_id, status (siguiendo|pendiente|leido|lo_quiero|lo_tengo|abandonado) — high
- ChapterRead: user_id, chapter_id — high
- List: id, owner, name, is_public, items[], followers — high
- Rating (user_id,title_id,score), Comment + Reaction (6 types), Report (reason) — medium
- Notifications: not documented. low

## 7. Feature matrix
See features.csv.

## 8. What cannot (or must not) be cloned
- The catalogue: scanlated/licensed works. Replaced by creator-owned uploads. Clone starts EMPTY, so seed with the team's own works.
- Community, rankings with real traffic, groups' existing audience.
- Hentai/+18 sibling sites. Adult content is out of v1 (needs age gating, store policy, payment rules).
- Telegram/chat ties, recruiting board.
- Name, logo, copy, art: replica-brand will replace them.

## 9. Size
- Screens: 12 (7 verified). Flows: 8. Entities: ~14.
- Hard parts: (1) chapter image storage/CDN and upload pipeline (many images per chapter, WebP conversion, size limits); (2) pending-chapters/resume logic across statuses and lists; (3) moderation + DMCA process for user uploads (legal must-have since anyone can upload); also Android APK packaging/store policy.
- Size: **M** for web core loop; **L** with APK, comments and moderation.
- Open gaps: reader UI, history, profile, notifications, mobile app behaviour. Verify with your own account and screenshots in replica/screens/.
