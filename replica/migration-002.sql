-- Run once in the Supabase SQL editor. Limits what the public 'media' bucket accepts:
-- the app only ever uploads WebP (see lib/image.ts), so anything else is not from the app.
update storage.buckets
set file_size_limit = 10485760, -- 10 MB per file
    allowed_mime_types = array['image/webp']
where id = 'media';
