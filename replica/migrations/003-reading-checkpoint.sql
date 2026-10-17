-- Reading checkpoint: the page where the reader left a chapter (null = finished or never scrolled).
-- Run once in the Supabase SQL editor. The reads_own policy already covers the new column.
alter table chapter_reads add column if not exists page int check (page > 0);
