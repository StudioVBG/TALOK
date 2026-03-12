# Audit des comptes Talok

**Date** : Mars 2026  
**Périmètre** : architecture des espaces par rôle, cohérence UI, qualité UX user-first, niveaux de dispersion.

---

## 1. Verdict global

Talok n’est **pas un simple fourre-tout sans logique**. La structure globale est sérieuse :
- séparation claire par rôle,
- redirections centralisées,
- dashboards dédiés,
- layouts responsives,
- onboarding présent dans plusieurs parcours.

En revanche, Talok est devenu **fragmenté dans ses implémentations UI** :
- plusieurs shells coexistent,
- certains comptes sont très aboutis,
- d’autres sont encore partiels, mockés, hybrides ou incohérents,
- l’expérience `user-first` est forte sur quelques rôles, mais pas homogène sur l’ensemble.

### Classement global

| Compte | Maturité | Niveau user-first | Verdict |
|---|---|---:|---|
| `tenant` | élevé | 9/10 | meilleur espace orienté action |
| `owner` | élevé | 8/10 | très riche mais plus dense |
| `admin` | moyen à élevé | 5/10 | puissant mais plus cockpit que parcours |
| `provider` | moyen | 6/10 | crédible mais encore dispersé |
| `guarantor` | moyen | 6/10 | simple mais incomplet |
| `copro` | moyen | 5/10 | bon squelette, encore partiel |
| `syndic` | moyen | 4/10 | dispersé entre plusieurs couches |
| `agency` | faible à moyen | 4/10 | très présentable, mais trop maquetté |

---

## 2. Points forts transverses

### 2.1 Architecture produit

- Les rôles sont bien séparés et les redirections sont centralisées dans `lib/helpers/role-redirects.ts`.
- Le callback d’authentification redirige intelligemment selon le rôle et l’état d’onboarding dans `app/auth/callback/route.ts`.
- Les comptes principaux ont un vrai découpage applicatif par espace : `owner`, `tenant`, `admin`, `provider`, `agency`, `syndic`, `copro`, `guarantor`.

### 2.2 UX/UI

- `owner` et `tenant` disposent d’une vraie architecture responsive avec sidebar desktop, rail tablette et bottom nav mobile.
- Les dashboards `owner` et `tenant` sont globalement pensés autour de la **prochaine action utile**.
- Les états vides, erreurs et onboarding existent réellement et ne sont pas juste décoratifs.
- Les améliorations récentes sur les dashboards ont renforcé la hiérarchie UX côté `owner` et `tenant`.

### 2.3 User-first

- Le meilleur signal user-first du projet est le compte `tenant`, qui parle en actions concrètes : signer, payer, déposer une assurance, signaler un problème.
- Le compte `owner` priorise bien les urgences métier : impayés, signatures, EDL, tâches à terminer, activité récente.
- Les layouts principaux aident déjà à l’orientation et à la continuité d’usage.

---

## 3. Faiblesses transverses

### 3.1 Fragmentation des shells

Le principal défaut d’architecture UI est ici : Talok a une **intention de système de design applicatif**, mais pas encore un vrai shell unifié.

Indices forts :
- `components/layout/AppShell.tsx` existe, mais n’est pas la vraie base commune du produit.
- `owner`, `tenant`, `provider`, `admin`, `agency`, `syndic`, `copro`, `guarantor` ont encore leurs propres variations de layout.
- les headers, sidebars, barres d’actions, patterns de navigation et d’onboarding ne sont pas assez standardisés.

### 3.2 Dette de cohérence

- Certains rôles sont très avancés, d’autres sont encore partiels ou semi-maquettés.
- Certaines pages paraissent terminées visuellement, mais ne sont pas au même niveau fonctionnel.
- Plusieurs patterns cohabitent : APIs dédiées, lecture client directe Supabase, mocks, flows inachevés.

### 3.3 User-first inégal

- `tenant` et `owner` sont nettement devant.
- `admin` est surtout orienté monitoring.
- `provider` et `guarantor` ont une UX plus administrative que guidée.
- `agency`, `syndic`, `copro` manquent d’un parcours vraiment fluide et homogène.

---

## 4. Audit par compte

## 4.1 `tenant`

### Verdict
Le meilleur compte du dépôt sur le plan `user-first`.

### Points forts

- Le dashboard est clair, hiérarchisé, et orienté actions concrètes dans `app/tenant/dashboard/DashboardClient.tsx`.
- Le parcours d’entrée est très bon : onboarding, progression, checklist, actions prioritaires.
- Le layout est cohérent, relativement sobre, et bien groupé par besoins dans `components/layout/tenant-app-layout.tsx`.
- Les états dégradés sont bien traités : pas de logement lié, logement supprimé, échéance, impayé, onboarding incomplet.

### Points faibles

- Le dashboard agrège beaucoup de sources de vérité : fallbacks, fetchs client, realtime, données serveur.
- Certaines pages d’onboarding sont moins élégantes et moins rassurantes que le dashboard.
- Le parcours reste bon, mais la cohérence visuelle entre les écrans n’est pas totale.

### Verdict UX/UI
Très bon. C’est aujourd’hui la meilleure référence Talok pour une expérience simple et utile.

---

## 4.2 `owner`

### Verdict
Très solide, mais plus dense et plus “produit complet” que vraiment minimaliste.

### Points forts

- Navigation riche et bien structurée dans `components/layout/owner-app-layout.tsx`.
- Dashboard bien priorisé dans `app/owner/dashboard/DashboardClient.tsx`.
- Très bon niveau de profondeur métier : patrimoine, loyers, baux, documents, maintenance, conformité.
- L’espace a gagné en lisibilité avec la séparation : urgences, tâches, activité, détails repliés.

### Points faibles

- Densité cognitive encore forte pour un petit bailleur non expert.
- Trop de couches injectées dans le shell : onboarding, aides, notifications, outils avancés, abonnement.
- Certaines conventions restent manuelles et non factorisées.
- Le parcours finance propriétaire dans `app/owner/onboarding/finance/page.tsx` expose trop vite un vocabulaire technique.

### Verdict UX/UI
Bon à très bon, mais encore trop chargé comparé au `tenant`.

---

## 4.3 `admin`

### Verdict
Puissant et sérieux, mais pas vraiment user-first au sens “action immédiate”.

### Points forts

- Structure claire du rôle dans `app/admin/layout.tsx`.
- Sidebar bien organisée dans `components/layout/admin-sidebar.tsx`.
- Couverture produit large : people, properties, plans, compliance, moderation, templates, intégrations.

### Points faibles

- L’admin agit davantage comme un cockpit de pilotage que comme un espace guidé.
- Peu de logique de “que dois-je faire maintenant ?”.
- Hétérogénéité entre pages simples et pages très lourdes.
- Incohérences d’autorisations possibles entre `admin` et `platform_admin`.

### Verdict UX/UI
Fonctionnel, crédible, mais moins humain et moins orienté action que les meilleurs espaces du produit.

---

## 4.4 `provider`

### Verdict
Le secondaire le plus crédible, mais encore techniquement dispersé.

### Points forts

- Layout et navigation corrects, avec un vrai sentiment d’espace métier.
- Couverture utile : missions, devis, factures, portfolio, dashboard.
- Le compte paraît plus concret que la plupart des rôles secondaires.

### Points faibles

- Onboarding encore faible, surtout la review finale dans `app/provider/onboarding/review/page.tsx`.
- Dette visible : `@ts-nocheck`, patterns techniques variés, cohérence incomplète.
- Certaines pages passent par des couches différentes sans logique unifiée.

### Verdict UX/UI
Prometteur, mais pas encore au niveau des comptes cœur.

---

## 4.5 `agency`

### Verdict
Le plus trompeur entre qualité visuelle et profondeur réelle.

### Points forts

- Architecture d’information lisible.
- Shell crédible.
- L’espace semble mature au premier regard.

### Points faibles

- Beaucoup d’écrans semblent encore très mockés ou démonstratifs.
- L’utilisateur peut croire à un produit complet alors que le backend n’est pas encore partout au même niveau.
- Très bon design de façade, maturité réelle plus faible.

### Verdict UX/UI
Visuellement bon, fonctionnellement trop partiel pour être vraiment user-first.

---

## 4.6 `syndic`

### Verdict
Dispersé et hybride.

### Points forts

- Vrai scope métier : onboarding, sites, assemblées, dépenses, appels, invitations.
- Navigation compréhensible.
- Bonne ambition produit.

### Points faibles

- Une partie du socle vit en fait dans `copro`.
- Certaines pages semblent branchées sur des routes ou patterns non homogènes.
- Unité visuelle moins forte que sur les rôles cœur.

### Verdict UX/UI
Lisible dans l’intention, mais trop éclaté pour être vraiment cohérent.

---

## 4.7 `copro`

### Verdict
Bon extranet en devenir, mais encore partiel.

### Points forts

- Périmètre assez clair : dashboard, AG, charges, documents, tickets.
- Layout simple, lisible, pas trop chargé.

### Points faibles

- Plusieurs zones encore semi-mockées ou incomplètes.
- Certaines dépendances API semblent fragiles.
- L’identité de l’espace est floue car il chevauche d’autres rôles.

### Verdict UX/UI
Prometteur, mais pas assez consolidé pour être pleinement rassurant.

---

## 4.8 `guarantor`

### Verdict
Simple, focalisé, mais incomplet.

### Points forts

- Peu fourre-tout.
- Périmètre compréhensible : dashboard, profil, documents.
- Charge cognitive faible.

### Points faibles

- Moins travaillé visuellement que les rôles majeurs.
- Flux finaux encore incomplets.
- Trop administratif, pas assez guidé émotionnellement alors que l’enjeu est juridique et sensible.

### Verdict UX/UI
Plus lisible que `agency` ou `syndic`, mais pas encore abouti.

---

## 5. Architecture UI globale

## 5.1 Ce qui fonctionne

- `SharedBottomNav` est une vraie brique de convergence.
- `owner` et `tenant` partagent maintenant une logique de header plus calme et contextuel.
- Les layouts principaux ont une vraie réflexion responsive.

## 5.2 Ce qui pose problème

- `AppShell` existe mais ne sert pas de base réelle.
- Les shells sont encore trop spécialisés au lieu d’être paramétrés.
- Les patterns transverses ne sont pas assez standardisés :
  - header,
  - recherche,
  - onboarding,
  - première connexion,
  - navigation secondaire,
  - footer de shell.

## 5.3 Conclusion architecture UI

L’architecture est **bonne au niveau macro**, mais **pas encore industrialisée** au niveau du système UI.

---

## 6. Analyse user-first

## 6.1 Les mieux conçus

1. `tenant`
2. `owner`
3. `provider`

## 6.2 Les plus fourre-tout ou les moins classés

1. `syndic`
2. `agency`
3. `admin` sur le plan UX d’action

## 6.3 Pourquoi

- `tenant` et `owner` priorisent mieux les prochaines actions.
- `admin` et `syndic` agrègent beaucoup plus qu’ils ne guident.
- `agency` vend une impression de maturité plus forte que sa profondeur réelle.

---

## 7. Priorités UX/UI les plus rentables

1. Unifier les shells autour d’un vrai `AppShell` commun avec variantes, au lieu de multiplier les layouts spécialisés.
2. Standardiser un même modèle de header contextuel pour tous les comptes cœur.
3. Harmoniser l’onboarding entre `owner`, `tenant`, `provider`, `guarantor`, `syndic`.
4. Étendre le niveau `user-first` du `tenant dashboard` aux autres rôles.
5. Reclasser les rôles secondaires comme modules ou espaces “maturité intermédiaire” tant qu’ils ne sont pas au niveau cœur.
6. Réduire l’écart entre design perçu et profondeur réelle, surtout sur `agency`.
7. Simplifier le parcours finance propriétaire avec plus de langage métier vulgarisé.
8. Donner à `admin` une couche “actions prioritaires” au-dessus des KPIs.
9. Consolider les accès et conventions de rôles (`admin`, `platform_admin`, `copro`, `syndic`).
10. Réduire les flows explicitement incomplets visibles par l’utilisateur, surtout côté `provider`.

---

## 8. Conclusion finale

Talok a une **vraie architecture produit**, mais pas encore une **architecture UX/UI totalement unifiée**.

Le produit est fort là où il aide vraiment l’utilisateur à agir :
- `tenant`,
- `owner`.

Il devient plus faible là où il expose :
- trop de couches,
- trop de fragmentation,
- ou une maturité inégale entre promesse visuelle et réalité produit.

La priorité n’est pas d’ajouter encore des comptes ou des pages.  
La priorité est de :
- **factoriser les shells**,
- **aligner les parcours sur les meilleurs rôles existants**,
- **rendre toute l’expérience plus homogène, plus lisible, plus user-first**.
