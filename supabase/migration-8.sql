-- CoTribu : mise à jour n°8 (souvenirs partagés avec les proches, pas de doublon quand un proche se reconnecte)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.

-- ============ 1. Un proche voit aussi les souvenirs partagés avec lui ============
drop policy if exists "docs_proches_read" on public.docs;
create policy "docs_proches_read" on public.docs for select to authenticated using (
  public.my_proche_id(household_id) is not null and (
    col in ('members','proches')
    or (col = 'requests' and coalesce(data->'to','[]'::jsonb)      ? public.my_proche_id(household_id))
    or (col = 'events'   and coalesce(data->'proches','[]'::jsonb) ? public.my_proche_id(household_id))
    or (col = 'memories' and coalesce(data->'proches','[]'::jsonb) ? public.my_proche_id(household_id))
  ));

-- ============ 2. Photos : la famille, ou le proche si la photo appartient à un souvenir partagé avec lui ============
create or replace function public.can_read_photo(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare h uuid; pid text;
begin
  h := ((storage.foldername(p_name))[1])::uuid;
  if public.is_full_member(h) then return true; end if;
  pid := public.my_proche_id(h);
  if pid is null then return false; end if;
  return exists (select 1 from public.docs d
    where d.household_id = h and d.col = 'memories'
      and coalesce(d.data->'proches','[]'::jsonb) ? pid
      and coalesce(d.data->'photos','[]'::jsonb)  ? p_name);
exception when others then return false;
end $$;

drop policy if exists "souvenirs_read" on storage.objects;
create policy "souvenirs_read" on storage.objects for select to authenticated
  using (bucket_id = 'souvenirs' and public.can_read_photo(name));

-- ============ 3. Rejoindre comme proche : on retrouve le proche existant du même prénom ============
-- (sur iPhone, l'appli installée repart de zéro : sans ça, chaque réinstallation créait un doublon)
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
  return h;
end $$;
revoke all on function public.join_as_proche(text,text) from public, anon;
grant execute on function public.join_as_proche(text,text) to authenticated;
