-- CoTribu : mise à jour n°9 (sécurité & RGPD)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.
--  1. Les codes d'invitation ne sont lisibles que par les membres de la famille (plus par les proches)
--  2. Personne ne peut s'offrir le Premium en modifiant la base ; on ne peut changer que le nom du foyer
--  3. Un proche ne voit plus la liste des appareils du foyer
--  4. Nouveau code famille / proche en un geste, et retrait d'un appareil
--  5. Limite d'essais de codes (10 erreurs par heure)
--  6. Suppression complète du compte (RGPD)

-- ============ 1 & 2. Foyers : colonnes visibles et modifiables ============
revoke select, update, insert, delete on public.households from authenticated, anon;
grant select (id, name, created_at, premium_until, premium_source) on public.households to authenticated;
grant update (name) on public.households to authenticated;

create or replace function public.household_codes(p_household uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  select jsonb_build_object('invite_code', invite_code, 'proche_code', proche_code) into r from public.households where id = p_household;
  return r;
end $$;

-- ============ 3. Appareils du foyer ============
drop policy if exists "hu_read" on public.household_users;
create policy "hu_read" on public.household_users for select to authenticated
  using (user_id = auth.uid() or public.is_full_member(household_id));
revoke update on public.household_users from authenticated, anon;
grant update (member_id) on public.household_users to authenticated;

-- ============ 4. Nouveau code / retirer un appareil ============
create or replace function public.renew_code(p_household uuid, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  loop c := public.gen_code(); exit when not exists (select 1 from public.households where invite_code = c or proche_code = c); end loop;
  if p_kind = 'proche' then update public.households set proche_code = c where id = p_household;
  else update public.households set invite_code = c where id = p_household; end if;
  return c;
end $$;

create or replace function public.remove_device(p_household uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_member(p_household) then raise exception 'pas_membre'; end if;
  delete from public.household_users where household_id = p_household and user_id = p_user;
  delete from public.push_subs where household_id = p_household and user_id = p_user;
end $$;

-- ============ 5. Limite d'essais de codes ============
create table if not exists public.join_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists join_attempts_user_at on public.join_attempts (user_id, at);
alter table public.join_attempts enable row level security;   -- aucune règle : invisible depuis l'appli

create or replace function public.check_attempts() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.join_attempts where at < now() - interval '1 day';
  if (select count(*) from public.join_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'trop_essais';
  end if;
end $$;

-- un code faux ne lève plus d'erreur (sinon l'essai ne serait pas compté) : la fonction renvoie « vide »
create or replace function public.join_household(p_code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  perform public.check_attempts();
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then insert into public.join_attempts (user_id) values (auth.uid()); return null; end if;
  insert into public.household_users (household_id, user_id, role) values (h.id, auth.uid(), 'member')
  on conflict do nothing;
  return h;
end $$;

create or replace function public.join_as_proche(p_code text, p_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households; pid text; existing public.household_users;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'nom_manquant'; end if;
  perform public.check_attempts();
  select * into h from public.households where proche_code = upper(trim(p_code));
  if h.id is null then insert into public.join_attempts (user_id) values (auth.uid()); return null; end if;
  select * into existing from public.household_users where household_id = h.id and user_id = auth.uid();
  if existing.user_id is null then
    select d.id into pid from public.docs d
      where d.household_id = h.id and d.col = 'proches'
        and lower(trim(d.data->>'name')) = lower(trim(p_name))
      order by d.updated_at desc nulls last limit 1;
    if pid is null then
      pid := 'p-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      insert into public.docs (household_id, col, id, data, updated_by)
      values (h.id, 'proches', pid, jsonb_build_object('id', pid, 'name', trim(p_name), 'color', floor(random()*8)::int, 'joinedAt', now()), auth.uid());
    end if;
    insert into public.household_users (household_id, user_id, role, member_id) values (h.id, auth.uid(), 'proche', pid);
  end if;
  -- un proche ne reçoit jamais les codes
  h.invite_code := null; h.proche_code := null;
  return h;
end $$;

-- ============ 6. Supprimer mon compte ============
-- Quitte tous les foyers. Si c'était le dernier adulte d'un foyer, le foyer et toutes ses données sont effacés
-- (les photos sont effacées juste avant par l'appli). Puis le compte lui-même est supprimé.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare r record; me uuid := auth.uid();
begin
  if me is null then raise exception 'non_connecte'; end if;
  for r in select household_id, role, member_id from public.household_users where user_id = me loop
    delete from public.household_users where household_id = r.household_id and user_id = me;
    if r.role = 'proche' and r.member_id is not null then
      delete from public.docs where household_id = r.household_id and col = 'proches' and id = r.member_id;
    end if;
    if not exists (select 1 from public.household_users where household_id = r.household_id and role = 'member') then
      delete from public.households where id = r.household_id;   -- docs, abonnements, compteurs : effacés en cascade
    end if;
  end loop;
  delete from public.push_subs where user_id = me;
  delete from public.feedback where user_id = me;
  delete from public.join_attempts where user_id = me;
  begin
    delete from auth.users where id = me;
  exception when others then null;   -- le compte anonyme ne contient aucune donnée personnelle
  end;
end $$;

-- quitter un foyer : s'il ne reste plus d'adulte, le foyer est effacé
create or replace function public.leave_household(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.household_users;
begin
  select * into r from public.household_users where household_id = p_household and user_id = auth.uid();
  if r.user_id is null then return; end if;
  delete from public.household_users where household_id = p_household and user_id = auth.uid();
  delete from public.push_subs where household_id = p_household and user_id = auth.uid();
  if not exists (select 1 from public.household_users where household_id = p_household and role = 'member') then
    delete from public.households where id = p_household;
  end if;
end $$;

-- ============ Droits ============
revoke all on function public.household_codes(uuid)      from public, anon;
revoke all on function public.renew_code(uuid,text)      from public, anon;
revoke all on function public.remove_device(uuid,uuid)   from public, anon;
revoke all on function public.check_attempts()           from public, anon, authenticated;
revoke all on function public.join_household(text)       from public, anon;
revoke all on function public.join_as_proche(text,text)  from public, anon;
revoke all on function public.delete_my_account()        from public, anon;
revoke all on function public.leave_household(uuid)      from public, anon;
grant execute on function public.household_codes(uuid)     to authenticated;
grant execute on function public.renew_code(uuid,text)     to authenticated;
grant execute on function public.remove_device(uuid,uuid)  to authenticated;
grant execute on function public.join_household(text)      to authenticated;
grant execute on function public.join_as_proche(text,text) to authenticated;
grant execute on function public.delete_my_account()       to authenticated;
grant execute on function public.leave_household(uuid)     to authenticated;
