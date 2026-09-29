# CoTribu

L'organisation de la maison, partagée par toute la famille : routines de ménage par pièce, récurrences avancées, répartition entre les membres et écran « Aujourd'hui ».

App web installable (PWA), hébergée sur GitHub Pages, données dans Supabase.

## Mise en place (une seule fois)

1. **Supabase → SQL Editor** : lancer dans l'ordre `supabase/schema.sql`, puis `migration-2.sql`, `migration-3.sql`, `migration-4.sql`, `migration-5.sql`.
2. **Supabase → Authentication** : activer *Allow anonymous sign-ins*.
3. **GitHub → Settings → Pages** : *Deploy from a branch*, branche `main`, dossier `/ (root)`.

L'app est ensuite disponible sur `https://tony97421.github.io/CoTribu/`.

## Fonctionnement

- Pas de compte à créer : chaque téléphone reçoit une connexion anonyme, puis crée un foyer ou le rejoint avec un **code d'invitation** à 6 caractères.
- Chaque foyer ne voit que ses propres données (règles d'accès Row Level Security dans `supabase/schema.sql`).
- Les cases cochées apparaissent en direct chez les autres membres (Supabase Realtime).
- La clé Supabase présente dans `index.html` est la clé **publique** (publishable) ; elle est faite pour être dans l'app. Ne jamais y mettre la clé *secret* / *service_role*.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page de l'app (charge les scripts) |
| `css/app.css` | charte graphique (palette, univers par couleur) |
| `js/core.js` | dates, récurrences, rayons, catégories, modèle de départ |
| `js/store.js` | Supabase : connexion, foyer, synchronisation, photos |
| `js/ui.js` | navigation, panneaux, événements communs |
| `js/accueil.js`, `maison.js`, `courses.js`, `planning.js`, `extras.js` | les univers (repas et souvenirs dans `extras.js`) |
| `js/push.js` | abonnement aux rappels |
| `js/proches.js` | cercle de proches et demandes de garde |
| `js/premium.js` | Premium par foyer, codes cadeaux, lien Google Agenda |
| `js/ai.js` | fonctions IA (Premium) |
| `js/points.js` | points et récompenses |
| `supabase/functions/cotribu-push/` | fonction serveur qui envoie les rappels |
| `supabase/functions/cotribu-ai/` | fonction serveur IA : Gemini (`GEMINI_API_KEY`) ou Claude (`ANTHROPIC_API_KEY`), choix par `AI_PROVIDER` |
| `supabase/functions/cotribu-ics/` | flux agenda privé pour Google Agenda |
| `supabase/admin.sql` | commandes pour offrir le Premium et créer des codes cadeaux |
| `sw.js` | cache hors ligne de l'app ; changer `VERSION` à chaque mise en ligne |
| `manifest.webmanifest`, `icons/` | installation sur l'écran d'accueil |
| `vendor/supabase-2.117.2.js` | bibliothèque Supabase |
| `supabase/schema.sql` | tables, règles d'accès, création/jonction de foyer |

## Rappels (notifications)

- Fonction `cotribu-push` à déployer dans Supabase (Edge Functions), avec *Verify JWT* désactivé.
- Secrets : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (jamais dans ce dépôt).
- Un déclencheur `pg_cron` l'appelle toutes les 15 minutes : rappel du matin (7h30-9h) et 1 h avant chaque événement.

## Recettes partagées

- Fonction `cotribu-recipe` (Edge Functions), avec *Verify JWT* désactivé (elle vérifie elle-même l'utilisateur), aucun secret : lit les ingrédients d'une page de recette (données schema.org « Recipe ») quand on partage un lien vers CoTribu.

## Au lancement sur les stores

- Dans `js/rating.js`, remplir `STORE.play` (identifiant du Play Store, ex. `fr.cotribu.app`) et plus tard `STORE.apple` (lien App Store) : la demande de note enverra alors vers la bonne fiche. Avant ça, elle propose de recommander CoTribu.

## À venir

- Version Play Store
