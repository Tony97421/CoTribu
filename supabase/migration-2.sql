-- CoTribu : mise à jour n°2 (courses, planning, repas, souvenirs + photos)
-- À coller dans Supabase → SQL Editor → New query → Run.
-- Peut être relancé sans danger.

-- 1. Nouveaux types de données
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check
  check (col in ('members','rooms','tasks','items','events','meals','memories'));

-- 2. Stockage des photos de souvenirs (privé, un dossier par foyer)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('souvenirs', 'souvenirs', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function public.is_member_folder(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_member(((storage.foldername(p_name))[1])::uuid);
exception when others then
  return false;
end $$;

drop policy if exists "souvenirs_read"   on storage.objects;
drop policy if exists "souvenirs_add"    on storage.objects;
drop policy if exists "souvenirs_remove" on storage.objects;
create policy "souvenirs_read"   on storage.objects for select to authenticated
  using (bucket_id = 'souvenirs' and public.is_member_folder(name));
create policy "souvenirs_add"    on storage.objects for insert to authenticated
  with check (bucket_id = 'souvenirs' and public.is_member_folder(name));
create policy "souvenirs_remove" on storage.objects for delete to authenticated
  using (bucket_id = 'souvenirs' and public.is_member_folder(name));
