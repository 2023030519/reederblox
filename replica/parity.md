# Parity report: readerblox vs ZonaTMO

Date 2026-10-15. Python is not installed here, so the score was computed with the same rules as `parity.py` (must 3, should 2, could 1; partial 0.5; `skip` rows left out) in Node.

## Verdict: not shippable by the skill's rule
Feature score **66.1 / 100** (25 features counted, 7 skipped). Must-haves done: **8 of 15**. No open S1 or S2 bug.
In plain words for your use (10 friends, sideloaded APK): the web app does the whole core loop. What is missing for you is mostly the **deployed site and the APK**, not features.

## Feature score by area (weakest first)
| area | score |
| --- | --- |
| platform (APK) | 0 |
| policy (adult gating) | 0, out of scope on purpose |
| social | 20 |
| ui | 50 |
| title page | 61 |
| browse | 64 |
| reader | 75 |
| creator | 75 |
| account, library, discovery | 100 |

## Missing, in build order
Must (7)
1. Android APK, not started.
2. Filters: no exclude-genres, no author filter, one genre only.
3. Search: title only (original also searches author and company).
4. Title page: no score (needs ratings).
5. Reader: strip and paged modes; no fit options.
6. Creator profile: no avatar.
7. Edit/delete uploads: built, delete not yet tested.

Should: ratings (no), sort by score/likes/chapters, dark-mode toggle not verified, mark-all not verified, lists done without following others' lists.
Could: comments, related titles, adult gating.

Skipped on purpose (7): scanlated catalogue, hentai/anime sibling sites, chat/Telegram, reports, share buttons, public/private profile.

## Layout diff
Not run. `replica/screens/` is empty (no screenshots of the original), and the layout tool also needs Python. Nothing to compare, so no layout score. If you want it, save screenshots of the original's home, directory, title page and reader at 1440x900 and 390x844 and give me Python.

## Behaviour differences
| flow | original | clone | decision |
| --- | --- | --- | --- |
| F01 find and read | home/directory -> title -> reader: 3 clicks | same 3 clicks; from pending on the home page it is 1 click ("Seguir leyendo") | keep, better |
| pending chapters | needs the title to have a status AND be in a list | needs only status "Siguiendo" | keep, simpler |
| chapter versions | several groups can upload the same chapter | one chapter per number | keep, own works only |
| reader | mark seen on open | same | same |
| accounts | register, many users | email + password, creators approved by hand in the dashboard | keep |
| moderation | report modal | none; you delete in the dashboard | keep for 10 people |
| not seen in the original | reader modes, history, notifications (not documented) | history built, no notifications | to verify with your own account |

## Top five to build next
1. Deploy the site (Vercel) and make the APK. Without that, friends cannot use it.
2. Ratings, so the title page shows a score.
3. Test the remaining manual cases in `replica/test-plan.md` (delete chapter, failed upload, second account).
4. Search by author, plus exclude-genre filter, only if your friends miss them.
5. Avatar on the profile, only if you want it.

## Better than the original?
Not measured yet. `/replica-entrepreneur` is the step for that. For a private group of friends it is probably not worth running.
