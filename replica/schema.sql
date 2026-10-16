-- readerblox schema, low-user version (about 20-30 users, friends publish their own work).
-- Postgres on Supabase. RLS on every table. Admin work (making someone a creator) is done by hand in the dashboard.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  avatar_url text,
  bio text,
  is_creator boolean not null default false, -- only you flip this, in the dashboard
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every new auth user gets a profile; username is a placeholder they can change.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, display_name)
  values (new.id, 'u' || substr(replace(new.id::text, '-', ''), 1, 12),
          coalesce(new.raw_user_meta_data->>'name', 'u' || substr(replace(new.id::text, '-', ''), 1, 12))); -- never the email: profiles are public
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table titles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade, -- the creator
  slug text not null unique,
  name text not null,
  synonyms text[] not null default '{}',
  synopsis text not null default '',
  cover_path text,
  type text not null check (type in ('manga','manhwa','manhua','webtoon','novel','comic','oneshot')),
  demography text check (demography in ('shounen','seinen','shoujo','josei','kodomo')),
  status text not null default 'publishing' check (status in ('publishing','finished','paused','cancelled')),
  year int,
  is_published boolean not null default false, -- draft until the creator publishes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on titles (owner_id);
create index on titles (created_at desc);
-- No index on type/demography/status/name: at a few dozen titles a scan is faster than the index.
-- shortcut: search is ilike on name, add a GIN full-text index past ~5k titles.

create table title_genres (
  title_id uuid not null references titles(id) on delete cascade,
  genre_id uuid not null references genres(id) on delete cascade,
  primary key (title_id, genre_id)
);
create index on title_genres (genre_id);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles(id) on delete cascade,
  number numeric(7,2) not null,               -- 53.1, 90.5 are legal
  name text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, number)
);
create index on chapters (published_at desc) where is_published;

create table pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  position int not null check (position > 0),
  image_path text not null,                   -- storage path under '<owner uid>/...'
  width int, height int,
  unique (chapter_id, position)
);

create table library_entries (
  user_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  status text not null check (status in ('following','pending','read','wanted','owned','dropped')),
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);
create index on library_entries (title_id);

create table chapter_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index on chapter_reads (chapter_id);
create index on chapter_reads (user_id, read_at desc); -- serves /history

create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on lists (owner_id);

create table list_items (
  list_id uuid not null references lists(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, title_id)
);
create index on list_items (title_id);

create table ratings (
  user_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  primary key (user_id, title_id)
);
create index on ratings (title_id);

create view title_stats with (security_invoker = true) as
  select title_id, round(avg(score)::numeric, 2) as score_avg, count(*) as votes
  from ratings group by title_id;

create table comments (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on comments (title_id, created_at desc);
create index on comments (user_id);

-- ---------- access rules (RLS) ----------
alter table profiles enable row level security;
alter table genres enable row level security;
alter table titles enable row level security;
alter table title_genres enable row level security;
alter table chapters enable row level security;
alter table pages enable row level security;
alter table library_entries enable row level security;
alter table chapter_reads enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;
alter table ratings enable row level security;
alter table comments enable row level security;

create policy genres_read on genres for select using (true);

create policy profiles_read on profiles for select using (true);
create policy profiles_write on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Users may edit their profile but never is_creator (that would let anyone self-promote).
revoke update on profiles from authenticated, anon;
grant update (username, display_name, avatar_url, bio) on profiles to authenticated;

create policy titles_read on titles for select using (is_published or owner_id = auth.uid());
create policy titles_write on titles for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator));

create policy tg_read on title_genres for select using (exists (select 1 from titles t where t.id = title_id and (t.is_published or t.owner_id = auth.uid())));
create policy tg_write on title_genres for all using (exists (select 1 from titles t where t.id = title_id and t.owner_id = auth.uid())) with check (exists (select 1 from titles t where t.id = title_id and t.owner_id = auth.uid()));

create policy ch_read on chapters for select using (exists (select 1 from titles t where t.id = title_id and (t.owner_id = auth.uid() or (chapters.is_published and t.is_published))));
create policy ch_write on chapters for all using (exists (select 1 from titles t where t.id = title_id and t.owner_id = auth.uid())) with check (exists (select 1 from titles t where t.id = title_id and t.owner_id = auth.uid()));

create policy pg_read on pages for select using (exists (select 1 from chapters c join titles t on t.id = c.title_id where c.id = chapter_id and (t.owner_id = auth.uid() or (c.is_published and t.is_published))));
create policy pg_write on pages for all using (exists (select 1 from chapters c join titles t on t.id = c.title_id where c.id = chapter_id and t.owner_id = auth.uid())) with check (exists (select 1 from chapters c join titles t on t.id = c.title_id where c.id = chapter_id and t.owner_id = auth.uid()));

create policy lib_own on library_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reads_own on chapter_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy lists_read on lists for select using (is_public or owner_id = auth.uid());
create policy lists_write on lists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy li_read on list_items for select using (exists (select 1 from lists l where l.id = list_id and (l.is_public or l.owner_id = auth.uid())));
create policy li_write on list_items for all using (exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())) with check (exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid()));

create policy ratings_read on ratings for select using (true);
create policy ratings_write on ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comments_read on comments for select using (true);
create policy comments_insert on comments for insert with check (user_id = auth.uid());
create policy comments_delete on comments for delete using (user_id = auth.uid());

-- ---------- storage ----------
-- One public bucket 'media' (covers + pages). Browsers upload straight to it; the first folder must be the creator's own uid.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('media', 'media', true, 10485760, array['image/webp']) on conflict do nothing;
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
-- shortcut: bucket is public, so an unpublished chapter's image is reachable by anyone who knows the path (unguessable uuid path). Move to signed URLs if drafts become sensitive.
