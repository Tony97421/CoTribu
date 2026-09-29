-- CoTribu : mise à jour n°6 (avis et idées des utilisateurs)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.
-- Les messages se lisent dans Table Editor → feedback (les utilisateurs peuvent écrire, jamais lire).
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid default auth.uid(),
  household_id uuid,
  kind         text not null check (kind in ('idee','probleme','bravo')),
  message      text not null check (char_length(message) between 3 and 4000),
  contact      text check (contact is null or char_length(contact) <= 200),
  info         jsonb,
  traite       boolean not null default false
);
alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = auth.uid());
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to authenticated;
