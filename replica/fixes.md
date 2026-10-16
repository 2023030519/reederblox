# Fixes and angle: what the research did and did not find

Sample size: **0 user reviews collected.** Not enough to rank anything, so there is no ranked "hate / missing / unsolved" list and `reviews.py` was not run (also needs Python, which is not installed).

## What I tried (2026-10-15)
- Three web searches for reviews and complaints about ZonaTMO / TuMangaOnline (Spanish and English, Trustpilot, Reddit). Results were unrelated companies with similar names. No App Store or Google Play listing exists for it that I could find, and I did not reach Reddit, G2 or a feature-request board.
- One search about the site itself, which turned up something that matters more than reviews (below).

## What the evidence says, with limits
Secondary news coverage (not user reviews, one search, not checked against the police statement):
- TuMangaOnline / ZonaTMO was shut down by Spanish authorities in April 2026; reports say four people were detained and the site earned about $4.7 million from advertising. Sources: [HackMag](https://hackmag.com/news/tmo-down), [BleepingComputer](https://bleepingcomputer.com/news/security/spain-dismantles-major-47m-manga-piracy-platform-arrests-four), [World Trademark Review](https://www.worldtrademarkreview.com/article/spanish-police-take-down-manga-piracy-giant-in-korean-backed-operation). Reports differ on the raid date and arrest count.
- The same coverage says pop-up ads appeared on nearly every user action, and that much of the advertising was pornographic. That is a claim by authorities and journalists, not a quote from a reader, so it is a lead and not a measured complaint.
- The zonatmo.org I read during recon was live and showed a notice about "restoring content". I did not verify whether it is the original operator or a mirror.

## What this means for readerblox
1. **Nothing here is a ranked complaint to fix.** Do not build features to "beat" the original on this evidence.
2. **The original's model is not one to compete with or copy:** your site has no ads and only the authors' own work, which already avoids the problem the coverage describes. That is a fact about your design, not a marketing angle you need.
3. **Positioning, launch and brand steps add little for a private group of 10.** Skipping `/replica-brand` and `/replica-launch` is reasonable. If you ever open the site publicly, run this step again with real reviews of legal readers, which this search did not find.
4. I added no rows to `features.csv`, because every candidate fix would have been my guess, not evidence.

## Better sources if you want evidence later
Reviews of licensed apps readers actually compare against (publisher apps and webtoon apps on the Play Store and App Store, their feature-request boards, r/manga and Spanish manga subreddits). Copy rows into `replica/reviews.csv` as `source,url,date,rating,text`, quotes verbatim with the link.

## The one useful thing to ask your friends
Ten people can tell you more than a review sheet: ask each what annoyed them in the first week. Write the answers as rows in `reviews.csv` with source `friends`.
