-- CoTribu : commandes d'administration (à lancer à la main dans Supabase → SQL Editor)
-- Rien ici ne s'exécute tout seul. Copie seulement la commande dont tu as besoin.

-- Voir les foyers (nom, codes, Premium)
select name, invite_code, proche_code, premium_until, premium_source, created_at
from public.households order by created_at desc;

-- Offrir le Premium à vie à un foyer (remplacer ABC234 par son code d'invitation famille)
-- update public.households set premium_until = '2100-01-01', premium_source = 'offert' where invite_code = 'ABC234';

-- Offrir 1 an de Premium à un foyer
-- update public.households set premium_until = greatest(coalesce(premium_until, now()), now()) + interval '1 year', premium_source = 'offert' where invite_code = 'ABC234';

-- Retirer le Premium
-- update public.households set premium_until = null, premium_source = null where invite_code = 'ABC234';

-- Créer un code cadeau : 1 an, utilisable par 1 foyer
-- insert into public.gift_codes (code, days, max_uses, note) values ('MAMIE2026', 365, 1, 'Pour Mamie');

-- Créer un code pour 20 testeurs : 3 mois chacun
-- insert into public.gift_codes (code, days, max_uses, note) values ('TESTEUR3M', 90, 20, 'Testeurs');

-- Voir les codes et leur utilisation
select code, days, max_uses, uses, note from public.gift_codes order by created_at desc;

-- Utilisation de l'IA par foyer et par mois
select h.name, u.month, u.calls from public.ai_usage u join public.households h on h.id = u.household_id order by u.month desc, u.calls desc;
