# Test plan: readerblox

Sized for about 10 friends. Automated: `npx playwright test` (16 tests in `e2e/`, runs against the dev server on :3001 and your real Supabase, anonymous visitor only). Manual: the rows marked M, which need you to be logged in.

Status: PASS = automated or driven in the browser and passed. TODO = not run yet. M = manual, needs a login.

## F01 Find and read (S01/S02 -> S03 -> S04)
| id | case | how | status |
| --- | --- | --- | --- |
| F01-H1 | anonymous: directory -> title -> chapter -> pages visible | e2e | PASS |
| F01-H2 | logged in: pending -> "Seguir leyendo" -> reader -> chapter in history | browser (earlier session) | PASS |
| F01-E1 | unknown title / chapter id shows friendly message | e2e | PASS |
| F01-E2 | paged reader mode, arrow keys | M | TODO |
| F01-E3 | image fails to load -> retry button | M | TODO |
| F01-E4 | title with no chapters | M | TODO |
| F01-E5 | long title (60+ chars) in cards and header, emoji, accents | M | TODO |
| F01-E6 | 390 px and 1440 px width | M (390 px seen) | TODO |
| F01-E7 | keyboard only through directory -> reader | M | TODO |

## F02 Follow a title / F03 Pending and history
| F02-H1 | set "Siguiendo" -> shows in pending | browser | PASS |
| F02-E1 | logged out -> prompt to log in | code path seen, no test | TODO |
| F03-E1 | mark all / unmark all, single checkbox | M | TODO |
| F03-E2 | two tabs: read in one, pending refreshed in other | M | TODO |

## F04 Search / filter
| F04-H1 | search finds a title | e2e | PASS |
| F04-E1 | no results -> empty state | e2e | PASS |
| F04-E2 | each filter and genre with a value, pagination at >20 titles | M | TODO |
| F04-E3 | search with % or _ characters | M | TODO |

## F06 Lists
| F06-H1 | create list, add title from the title page, see it in the list | browser | PASS |
| F06-E1 | public list visible to another user; private list invisible | e2e covers anon only; second user M | PARTIAL |
| F06-E2 | delete a list (titles stay), remove one item | M | TODO |

## F07 Creator publishes
| F07-H1 | create title, cover, 3-page chapter, publish | browser | PASS |
| F07-E1 | duplicate chapter number -> friendly message | M | TODO |
| F07-E2 | non-image file in the batch -> error, no half chapter, no orphan files | M | TODO |
| F07-E3 | very tall image (over 16000 px) | M | TODO |
| F07-E4 | double click on Subir | M | TODO |
| F07-E5 | delete chapter removes its files | M | TODO |
| F07-E6 | reader (non-creator) sees "Tu cuenta aún no es de creador" | M, needs a second account | TODO |
| F07-N1 | anonymous visitor at /studio and /studio/[id] asks to log in | e2e | PASS |

## Profile (/u)
| P-H1 | edit username + bio, URL follows the new username | browser | PASS |
| P-N1 | username already taken / invalid format -> message | M | TODO |

## Security (anonymous, e2e/rls.spec.ts)
| S-1 | only published titles and chapters are visible | PASS |
| S-2 | library, reads, private lists unreadable | PASS |
| S-3 | cannot insert/update/delete titles, chapters, library, comments, profiles (incl. is_creator) | PASS |
| S-4 | cannot upload to storage | PASS |
| S-5 | a logged-in non-creator cannot create titles or upload; cannot edit someone else's title/chapter/pages/storage | second account needed | TODO |

## Accessibility
axe scan on `/`, `/biblioteca`, `/lists`, `/login`, `/faq`, `/normas`, and the reader: no serious or critical violations (PASS). Title page, studio, profile: not scanned (need data/login).
