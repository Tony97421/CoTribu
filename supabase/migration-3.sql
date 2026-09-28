-- CoTribu : mise à jour n°3 (notifications)
-- À coller dans Supabase → SQL Editor → New query → Run.

-- 1. Téléphones abonnés aux rappels
create table if not exists public.push_subs (
  endpoint     text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id    text,
  sub          jsonb not null,
  tz           text not null default 'Europe/Paris',
  created_at   timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push_own" on public.push_subs;
create policy "push_own" on public.push_subs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(household_id));

-- 2. Journal des rappels déjà envoyés (utilisé seulement par le serveur)
create table if not exists public.push_log (
  key     text primary key,
  sent_at timestamptz not null default now()
);
alter table public.push_log enable row level security;

-- 3. Outils de planification
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 4. Le déclencheur toutes les 15 minutes est à créer avec le script
--    personnel envoyé dans la conversation (il contient le mot secret, à ne pas publier).
