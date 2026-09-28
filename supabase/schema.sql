-- CoTribu : base de données partagée
-- À coller une fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans danger.

-- 1. Foyers ---------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Notre maison',
  invite_code text not null unique,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2. Qui (compte de l'appareil) appartient à quel foyer --------------------
create table if not exists public.household_users (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  member_id    text,                       -- le profil choisi (« Sur ce téléphone, je suis… »)
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 3. Données du foyer : membres, pièces, tâches (documents JSON) -----------
create table if not exists public.docs (
  household_id uuid not null references public.households(id) on delete cascade,
  col          text not null check (col in ('members','rooms','tasks','items','events','meals','memories')),
  id           text not null,
  data         jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid(),
  primary key (household_id, col, id)
);
alter table public.docs replica identity full;

-- 4. Règles d'accès : chacun ne voit que son foyer -------------------------
create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_users where household_id = h and user_id = auth.uid());
$$;

alter table public.households      enable row level security;
alter table public.household_users enable row level security;
alter table public.docs            enable row level security;

drop policy if exists "households_read"   on public.households;
drop policy if exists "households_update" on public.households;
create policy "households_read"   on public.households for select to authenticated using (public.is_member(id));
create policy "households_update" on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "hu_read"   on public.household_users;
drop policy if exists "hu_update" on public.household_users;
drop policy if exists "hu_leave"  on public.household_users;
create policy "hu_read"   on public.household_users for select to authenticated using (public.is_member(household_id));
create policy "hu_update" on public.household_users for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "hu_leave"  on public.household_users for delete to authenticated using (user_id = auth.uid());

drop policy if exists "docs_all" on public.docs;
create policy "docs_all" on public.docs for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- 5. Créer un foyer / rejoindre avec un code -------------------------------
create or replace function public.create_household(p_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  h     public.households;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Notre maison'), code, auth.uid())
  returning * into h;
  insert into public.household_users (household_id, user_id) values (h.id, auth.uid());
  return h;
end $$;

create or replace function public.join_household(p_code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'code_invalide'; end if;
  insert into public.household_users (household_id, user_id) values (h.id, auth.uid())
  on conflict do nothing;
  return h;
end $$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text)   from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text)   to authenticated;

-- 6. Temps réel : les cases cochées apparaissent chez tout le monde ---------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 7. Courses, planning, repas, souvenirs : voir migration-2.sql (à lancer aussi)
