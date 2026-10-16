-- Phase 9: creators can add new genres. Run once in the Supabase SQL editor.
-- genres.slug is unique, so a duplicate genre is rejected (the app shows "Ese género ya existe").
create policy genres_create on genres for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator));
