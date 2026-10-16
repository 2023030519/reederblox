-- Run once in the Supabase SQL editor (already folded into schema.sql for fresh installs).

-- 1. Draft chapters were readable by anyone: unqualified is_published bound to titles, not chapters.
drop policy ch_read on chapters;
create policy ch_read on chapters for select using (exists (
  select 1 from titles t where t.id = title_id
    and (t.owner_id = auth.uid() or (chapters.is_published and t.is_published))));

-- 3. New users no longer get their email prefix as public display name.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, display_name)
  values (new.id, 'u' || substr(replace(new.id::text, '-', ''), 1, 12),
          coalesce(new.raw_user_meta_data->>'name', 'u' || substr(replace(new.id::text, '-', ''), 1, 12)));
  return new;
end $$;

-- Existing accounts whose display name is still the email prefix: replace it with their username.
update profiles p set display_name = p.username
from auth.users u
where u.id = p.id and p.display_name = split_part(u.email, '@', 1);
