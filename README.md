# CoTribu

L'organisation de la maison, partagée par toute la famille : routines de ménage par pièce, récurrences avancées, répartition entre les membres et écran « Aujourd'hui ».

App web installable (PWA), hébergée sur GitHub Pages, données dans Supabase.

## Mise en place (une seule fois)

1. **Supabase → SQL Editor** : coller le contenu de `supabase/schema.sql` et cliquer sur *Run*.
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
| `index.html` | toute l'application (interface, moteur de récurrences, synchronisation) |
| `sw.js` | cache hors ligne de l'app ; changer `VERSION` à chaque mise en ligne |
| `manifest.webmanifest`, `icons/` | installation sur l'écran d'accueil |
| `vendor/supabase-2.117.2.js` | bibliothèque Supabase |
| `supabase/schema.sql` | tables, règles d'accès, création/jonction de foyer |

## À venir

- Notifications (rappels du jour envoyés à la bonne personne)
- Liste de courses partagée, planning familial, souvenirs
- Version Play Store
