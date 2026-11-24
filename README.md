# Life Planner

Application web personnelle (PWA) de planning et d'organisation : études, vie personnelle, Glow up, vie sociale, projets, finances, carrière, langues, habitudes, sommeil et lecture. Interface en français, thèmes clair et sombre, utilisable sur MacBook et iPhone.

## Ce qui est inclus

- **Vues** Accueil, Journée, Semaine (glisser-déposer jour et horaire), Mois (glisser-déposer entre les jours), Année (n'importe quelle année) et année universitaire (dates choisies par toi).
- **Une seule source de données** : chaque modification se répercute partout.
- **Activités récurrentes** stockées une seule fois (pas de doublons à l'actualisation), modifiables pour une occurrence, les suivantes ou toute la série.
- **Rien n'est jamais validé automatiquement** : seules les tâches cochées comptent ; le temps réel est demandé à la validation et reste distinct du temps prévu. Une tâche non faite ne disparaît pas (section « Encore à faire »), on peut la reporter, la reprogrammer, la modifier ou la supprimer.
- **Espaces** : Études (emploi du temps à remplir chaque semaine, matières, chapitres, exercices, notions à revoir, examens, notes, objectifs, planification des révisions), Confiance & Glow up (objectifs libres, journal, confiance, affirmations, repas, hydratation), Vie sociale, Projets & business, Finances, Vie personnelle, Sport (séances types, historique, progression), Beauté (routines quotidiennes, hebdomadaires ou ponctuelles), Carrière (candidatures, entretiens, documents, compétences), Langues (anglais, espagnol et autres), Sommeil & habitudes, Lecture.
- **Propositions de révision** placées dans tes disponibilités, autour de tes cours, avec pauses, limite quotidienne et temps libre préservé. Chaque proposition peut être acceptée, modifiée ou refusée ; rien n'est ajouté sans ton accord.
- **Bilans** hebdomadaire (comparaison objectifs/résultats, graphiques, tâches non réalisées à trier, résumé bienveillant basé sur tes données, historique enregistré), mensuel et annuel.
- **Personnalisation** : nom du planner, thème, catégories (ajout, suppression, couleurs, ordre de priorité), matières, habitudes, disponibilités, notifications, citations.
- **Sauvegarde** : base locale permanente (IndexedDB) + export/import JSON + synchronisation cloud Supabase.

## Données, compte et synchronisation

- Sans configuration, les données restent **sur l'appareil** (elles survivent à la fermeture).
- Avec Supabase, tu as un **compte e-mail + mot de passe** et tes données sont synchronisées entre MacBook et iPhone. Les mots de passe sont gérés et chiffrés par Supabase Auth : l'application ne les stocke jamais.
- Chaque ligne de la base est protégée par Row Level Security : un compte ne peut lire que ses propres données.
- En cas de coupure réseau, les modifications sont gardées et renvoyées automatiquement ; l'état est affiché en haut (« Synchronisé », « Hors ligne », « Erreur de synchro »…).

### Activer Supabase

1. Créer un projet sur https://supabase.com (région Europe).
2. SQL Editor → coller `supabase/schema.sql` → Run.
3. Récupérer la *Project URL* et la clé *publishable* / *anon* (jamais la clé secrète).
4. Les fournir à la compilation (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, voir `.env.example`) ou les saisir dans Paramètres › Compte et synchronisation.
5. Authentication › URL Configuration : mettre l'adresse du site dans *Site URL* et *Redirect URLs* (pour les e-mails de confirmation et de mot de passe oublié).

## Installer sur iPhone

Ouvrir le site dans **Safari** → bouton Partager → **« Sur l'écran d'accueil »**. L'application s'ouvre alors en plein écran comme une app.

## Notifications : ce qui marche et ce qui ne marche pas encore

- Les rappels sont toujours visibles dans l'application (cloche).
- Les notifications système s'affichent quand l'application est ouverte ou récemment active. Sur iPhone : seulement une fois l'app ajoutée à l'écran d'accueil (iOS 16.4+) et autorisée dans Paramètres.
- **Non inclus pour l'instant** : les notifications envoyées quand l'application est complètement fermée (« push » serveur). Cela nécessite un service d'envoi (par exemple une fonction Supabase planifiée + clés Web Push).

## Limites connues

- Les documents (CV, lettres) sont enregistrés sous forme de liens, pas de fichiers.
- Le tableau de bord d'accueil est provisoire tant que le « planner de référence » n'a pas été partagé.

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires (récurrences, statistiques, suggestions, synchronisation)
npm run build      # version de production dans dist/
npx vite preview --port 4173 & node tests/e2e.mjs   # tests de bout en bout (Playwright)
```
