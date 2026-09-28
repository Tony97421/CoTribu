-- CoTribu : mise à jour n°5 (récompenses)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans danger.
alter table public.docs drop constraint if exists docs_col_check;
alter table public.docs add constraint docs_col_check
  check (col in ('members','rooms','tasks','items','events','meals','memories','proches','requests','albums','rewards'));
