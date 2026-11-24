-- Life Planner — schéma Supabase
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Chaque utilisatrice ne peut lire et écrire QUE ses propres lignes (Row Level Security).

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.records for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records_delete_own" on public.records for delete using (auth.uid() = user_id);

-- L'horodatage est fixé par le serveur (évite les décalages d'horloge entre appareils).
create or replace function public.records_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_updated_at on public.records;
create trigger records_updated_at before insert or update on public.records
for each row execute function public.records_set_updated_at();
