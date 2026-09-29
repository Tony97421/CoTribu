-- CoTribu : mise à jour n°7 (notification des administrateurs à chaque nouvel avis)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.

-- 1. Liste des administrateurs (lue seulement par le serveur, invisible depuis l'appli)
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 2. Ajouter comme administrateur chaque téléphone où le profil « Tony » a activé les rappels
--    (changer 'Tony' si besoin ; relancer après avoir activé les rappels sur un nouveau téléphone)
insert into public.admins (user_id)
select distinct ps.user_id
from public.push_subs ps
join public.docs d on d.household_id = ps.household_id and d.col = 'members' and d.id = ps.member_id
where d.data->>'name' = 'Tony'
on conflict do nothing;

-- 3. Vérification : doit afficher au moins une ligne
select a.user_id, a.added_at from public.admins a;
