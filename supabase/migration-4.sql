-- CoTribu : mise à jour n°4 (proches & demandes, Premium & codes cadeaux, IA, Google Agenda)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.

-- ============ 1. Rôles : membre de la famille ou proche ============
alter table public.household_users add column if not exists role text not null default 'member';
do $$ begin
  alter table public.household_users add constraint household_users_role_check check (role in ('member','proche'));
exception when duplicate_object then null; end $$;

create or replace function public.gen_code() returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text := '';
begin
  for i in 1..6 loop code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
  return code;
end $$;

alter table public.households add column if not exists proche_code   text unique;
alter table public.households add column if not exists premium_until timestamptz;
alter table public.households add column if not exists premium_source text;
update public.households set proche_code = public.gen_code() where proche_code is null;

-- membre à part entière (voit tout le foyer)
create or replace function public.is_full_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_users where household_id = h and user_id = auth.uid() and role = 'member');
$$;
-- identifiant « proche » de la personne connectée dans ce foyer (null si ce n'est pas un proche)
create or replace function public.my_proche_id(h uuid)
returns text language sql stable security definer set search_path = public as $$
  select member_id from public.household_users where household_id = h and user_id = auth.uid() and role = 'proche' limit 1;
$$;

-- ============ 2. Données : nouveaux types + règles d'accès ============
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check
  check (col in ('members','rooms','tasks','items','events','meals','memories','proches','requests','albums'));

drop policy if exists "docs_all"          on public.docs;
drop policy if exists "docs_members"      on public.docs;
drop policy if exists "docs_proches_read" on public.docs;
create policy "docs_members" on public.docs for all to authenticated
  using (public.is_full_member(household_id)) with check (public.is_full_member(household_id));
-- un proche ne voit que : les prénoms, les proches, les demandes qui lui sont adressées, les événements où il est concerné
create policy "docs_proches_read" on public.docs for select to authenticated using (
  public.my_proche_id(household_id) is not null and (
    col in ('members','proches')
    or (col = 'requests' and coalesce(data->'to','[]'::jsonb) ? public.my_proche_id(household_id))
    or (col = 'events'   and coalesce(data->'proches','[]'::jsonb) ? public.my_proche_id(household_id))
  ));

drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households for update to authenticated
  using (public.is_full_member(id)) with check (public.is_full_member(id));

drop policy if exists "hu_update" on public.household_users;
create policy "hu_update" on public.household_users for update to authenticated
  using (user_id = auth.uid() and role = 'member') with check (user_id = auth.uid() and role = 'member');

-- les photos restent réservées à la famille
create or replace function public.is_member_folder(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_full_member(((storage.foldername(p_name))[1])::uuid);
exception when others then return false;
end $$;

-- ============ 3. Création de foyer (avec code proche) ============
create or replace function public.create_household(p_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare code text; pcode text; h public.households;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  loop code := public.gen_code(); exit when not exists (select 1 from public.households where invite_code = code or proche_code = code); end loop;
  loop pcode := public.gen_code(); exit when pcode <> code and not exists (select 1 from public.households where invite_code = pcode or proche_code = pcode); end loop;
  insert into public.households (name, invite_code, proche_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Notre maison'), code, pcode, auth.uid()) returning * into h;
  insert into public.household_users (household_id, user_id, role) values (h.id, auth.uid(), 'member');
  return h;
end $$;

-- ============ 4. Rejoindre comme proche ============
create or replace function public.join_as_proche(p_code text, p_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households; pid text; existing public.household_users;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'nom_manquant'; end if;
  select * into h from public.households where proche_code = upper(trim(p_code));
  if h.id is null then raise exception 'code_invalide'; end if;
  select * into existing from public.household_users where household_id = h.id and user_id = auth.uid();
  if existing.user_id is not null then return h; end if;
  pid := 'p-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.household_users (household_id, user_id, role, member_id) values (h.id, auth.uid(), 'proche', pid);
  insert into public.docs (household_id, col, id, data, updated_by)
  values (h.id, 'proches', pid, jsonb_build_object('id', pid, 'name', trim(p_name), 'color', floor(random()*8)::int, 'joinedAt', now()), auth.uid());
  return h;
end $$;

-- ============ 5. Réponse d'un proche à une demande ============
create or replace function public.respond_request(p_household uuid, p_request text, p_answer text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text; r jsonb; pname text; declined int; total int; ev jsonb; evid text;
begin
  pid := public.my_proche_id(p_household);
  if pid is null then raise exception 'pas_proche'; end if;
  if p_answer not in ('accept','decline','counter') then raise exception 'reponse_invalide'; end if;
  select data into r from public.docs where household_id = p_household and col = 'requests' and id = p_request for update;
  if r is null or not (coalesce(r->'to','[]'::jsonb) ? pid) then raise exception 'demande_introuvable'; end if;
  if r->>'status' = 'cancelled' then raise exception 'demande_annulee'; end if;
  if p_answer = 'accept' and r->>'status' = 'accepted' and r->>'acceptedBy' <> pid then raise exception 'deja_pris'; end if;
  select data->>'name' into pname from public.docs where household_id = p_household and col = 'proches' and id = pid;

  r := jsonb_set(r, '{responses}', coalesce(r->'responses','{}'::jsonb) ||
        jsonb_build_object(pid, jsonb_build_object('answer', p_answer, 'note', coalesce(p_note,''), 'at', now())));

  if p_answer = 'accept' then
    evid := 'e-g-' || p_request;
    r := r || jsonb_build_object('status','accepted','acceptedBy',pid,'eventId',evid);
    ev := jsonb_build_object('id', evid, 'title', coalesce(pname,'Proche') || ' · ' || coalesce(r->>'title','Garde'),
      'cat','garde', 'date', r->>'date', 'allDay', coalesce((r->>'allDay')::boolean,false),
      'start', coalesce(r->>'start',''), 'end', coalesce(r->>'end',''),
      'members', coalesce(r->'children','[]'::jsonb), 'proches', jsonb_build_array(pid),
      'place', coalesce(r->>'place',''), 'note', coalesce(r->>'note',''), 'repeat','none', 'skip','[]'::jsonb, 'requestId', p_request);
    insert into public.docs (household_id, col, id, data, updated_by) values (p_household, 'events', evid, ev, auth.uid())
    on conflict (household_id, col, id) do update set data = excluded.data, updated_at = now();
  elsif p_answer = 'decline' then
    if r->>'acceptedBy' = pid then
      r := r || jsonb_build_object('status','pending','acceptedBy',null);
      delete from public.docs where household_id = p_household and col = 'events' and id = 'e-g-' || p_request;
    end if;
    select count(*) into total from jsonb_array_elements_text(coalesce(r->'to','[]'::jsonb));
    select count(*) into declined from jsonb_each(r->'responses') where value->>'answer' = 'decline';
    if declined >= total and r->>'status' <> 'accepted' then r := r || jsonb_build_object('status','declined'); end if;
  end if;

  update public.docs set data = r, updated_at = now(), updated_by = auth.uid()
  where household_id = p_household and col = 'requests' and id = p_request;
  return r;
end $$;

create or replace function public.remove_proche(p_household uuid, p_proche text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  delete from public.household_users where household_id = p_household and role = 'proche' and member_id = p_proche;
  delete from public.docs where household_id = p_household and col = 'proches' and id = p_proche;
  delete from public.push_subs where household_id = p_household and member_id = p_proche;
end $$;

-- ============ 6. Premium par foyer & codes cadeaux ============
create table if not exists public.gift_codes (
  code       text primary key,
  days       int  not null default 365,
  max_uses   int  not null default 1,
  uses       int  not null default 0,
  note       text,
  created_at timestamptz not null default now()
);
create table if not exists public.gift_redemptions (
  code         text not null references public.gift_codes(code) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  at           timestamptz not null default now(),
  primary key (code, household_id)
);
alter table public.gift_codes enable row level security;
alter table public.gift_redemptions enable row level security;

create or replace function public.redeem_gift(p_household uuid, p_code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare g public.gift_codes; h public.households;
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  select * into g from public.gift_codes where code = upper(trim(p_code)) for update;
  if g.code is null then raise exception 'code_cadeau_invalide'; end if;
  if g.uses >= g.max_uses then raise exception 'code_cadeau_epuise'; end if;
  if exists (select 1 from public.gift_redemptions where code = g.code and household_id = p_household) then raise exception 'code_cadeau_deja_utilise'; end if;
  update public.households
     set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => g.days),
         premium_source = 'cadeau'
   where id = p_household returning * into h;
  insert into public.gift_redemptions (code, household_id) values (g.code, p_household);
  update public.gift_codes set uses = uses + 1 where code = g.code;
  return h;
end $$;

-- ============ 7. Compteur d'utilisation de l'IA ============
create table if not exists public.ai_usage (
  household_id uuid not null references public.households(id) on delete cascade,
  month        text not null,
  calls        int  not null default 0,
  primary key (household_id, month)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_read" on public.ai_usage;
create policy "ai_usage_read" on public.ai_usage for select to authenticated using (public.is_full_member(household_id));

-- ============ 8. Lien privé Google Agenda ============
create table if not exists public.household_secrets (
  household_id uuid primary key references public.households(id) on delete cascade,
  ics_token    uuid not null default gen_random_uuid()
);
alter table public.household_secrets enable row level security;

create or replace function public.get_ics_token(p_household uuid, p_reset boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  insert into public.household_secrets (household_id) values (p_household) on conflict do nothing;
  if p_reset then update public.household_secrets set ics_token = gen_random_uuid() where household_id = p_household; end if;
  select ics_token into t from public.household_secrets where household_id = p_household;
  return t;
end $$;

-- ============ 9. Droits d'exécution ============
revoke all on function public.join_as_proche(text,text)             from public, anon;
revoke all on function public.respond_request(uuid,text,text,text)  from public, anon;
revoke all on function public.redeem_gift(uuid,text)                from public, anon;
revoke all on function public.remove_proche(uuid,text)              from public, anon;
revoke all on function public.get_ics_token(uuid,boolean)           from public, anon;
grant execute on function public.join_as_proche(text,text)            to authenticated;
grant execute on function public.respond_request(uuid,text,text,text) to authenticated;
grant execute on function public.redeem_gift(uuid,text)               to authenticated;
grant execute on function public.remove_proche(uuid,text)             to authenticated;
grant execute on function public.get_ics_token(uuid,boolean)          to authenticated;
