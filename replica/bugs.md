# Bugs

## Fixed
| id | sev | where | what | evidence | fix |
| --- | --- | --- | --- | --- | --- |
| B01 | S2 | studio upload | Cover and chapter pages failed with "new row violates row-level security policy". Storage `upsert: true` needs an UPDATE policy. | Chrome, chapter upload, 2026-10-15 | `upsert: false` in `app/studio/[id]/page.tsx` |
| B02 | S2 | /title/[slug] | Page showed "Could not embed because more than one relationship was found for 'titles' and 'profiles'". | Chrome | `profiles!owner_id(...)` in the query |
| B03 | S3 | /studio/[id] | After saving, the page blanked and the chapter form lost its fields. | refs vanished after save | skeleton only on first load |
| B04 | S4 | /studio/[id] | File input still said "3 files" after a successful upload. | screenshot | input remounted with a key |
| B05 | S4 | /studio/[id] | Logged-out visitors saw "Esta obra no es tuya" instead of a login prompt; non-owners saw an English database error. | Chrome, then e2e `B05` (failed first, passes now) | login check first, `maybeSingle`, Spanish message |
| B06 | S3 | layout | React console error: script tag inside the component. | pasted by user | `next/script` |
| B07 | S3 | all forms | Text in inputs and selects stayed black on the dark theme (browsers do not inherit colour into form controls). Seen in the library filters; e2e `B07` checks the computed colour. | Chrome screenshot | `color-scheme` + `color: var(--c-text)` for inputs in globals.css |
| B08 | S3 | offline download | Pages were downloaded one at a time; a 91-page chapter took about 40 s. Found when the offline e2e test picked it up. | e2e timeout | 5 parallel downloads in `lib/offline.ts` |

## Open
None reproduced.

## To check (not reproduced)
- T1: the browser session was found signed out between two test runs, with no one pressing "Salir" that I know of. Could be Supabase refresh-token handling in `useMe` or the user logging out. If it happens again, note the time and what you did before.
- T2: one screenshot timed out while opening the reader (renderer unresponsive, recovered on its own). Probably the browser tool, but worth watching with a 60-page chapter.
- T3: `/lists` shows other people's public lists with their name; check on a second account that private lists never appear.
