# Audit forfaits et UX par plan

Date: 2026-03-12

## Objectif

Ce document répond à 3 questions produit :

1. Que permet réellement chaque forfait dans le code aujourd'hui ?
2. Quelle est la configuration actuelle effective de chaque forfait ?
3. Les UX/UI sont-elles vraiment différentes selon le forfait ?

Réponse courte :

- Les forfaits sont bien différenciés côté logique métier.
- La configuration actuelle est assez riche, mais pas toujours cohérente entre marketing, API et UI.
- L'UX/UI n'est pas assez différenciée selon le forfait : la plupart des écarts apparaissent trop tard, après clic, via blur, modal ou redirection.

## Sources de vérité analysées

- `lib/subscriptions/plans.ts`
- `lib/subscriptions/pricing-config.ts`
- `components/subscription/subscription-provider.tsx`
- `lib/middleware/subscription-check.ts`
- `app/api/subscriptions/features/route.ts`
- `app/api/subscriptions/checkout/route.ts`
- `app/pricing/page.tsx`
- `app/owner/money/tabs/MonForfaitTab.tsx`
- `components/subscription/plan-gate.tsx`
- `components/subscription/smart-paywall.tsx`
- `components/subscription/upgrade-modal.tsx`
- `components/layout/AppShell.tsx`
- `components/layout/unified-fab.tsx`
- `app/owner/settings/page.tsx`

## 1. Matrice source de vérité par forfait

### Vue synthétique

| Forfait | Biens | Baux | Locataires | Utilisateurs | Signatures/mois | Surcoût bien | Paiement en ligne | Open banking | EDL digital | Colocation | Prestataires | API | White-label | Copro |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gratuit` | 1 | 1 | 2 | 1 | 0 | non | non | non | non | non | non | non | non | non |
| `starter` | 3 | 5 | 10 | 1 | 0 | `+3€/bien` | oui | non | non | non | non | non | non | non |
| `confort` | 10 | 25 | 40 | 2 | 2 | `+2,50€/bien` | oui | basique | oui | oui | non | non | non | non |
| `pro` | 50 | illimité | illimité | 5 | 10 | `+2€/bien` | oui | avancé | oui | oui | oui | oui | non | non |
| `enterprise_s` | 100 | illimité | illimité | illimité | 25 | non | oui | premium | oui | oui | oui | full | non | non |
| `enterprise_m` | 200 | illimité | illimité | illimité | 40 | non | oui | premium | oui | oui | oui | full | basique | non |
| `enterprise_l` | 500 | illimité | illimité | illimité | 60 | non | oui | premium | oui | oui | oui | full | complet | oui |
| `enterprise_xl` | illimité | illimité | illimité | illimité | illimité | non | oui | premium | oui | oui | oui | full | premium | oui |

### Différences fonctionnelles majeures

| Forfait | Positionnement réel | Fonctions structurantes |
| --- | --- | --- |
| `gratuit` | Découverte | bail généré, portail locataire basique, suivi simple |
| `starter` | Encaissement de base | paiement CB/SEPA, relance email basique, portail basique |
| `confort` | Vrai produit locatif complet | open banking, rapprochement, IRL, analytics owner, scoring IA, EDL, colocation |
| `pro` | Exploitation semi-pro / pro | rôles, journal d'activité, SMS, prestataires, API, planning travaux |
| `enterprise_s` | Scale sans branding | multi-mandants, webhooks, frais réduits, account manager partagé |
| `enterprise_m` | Début de marque blanche | white-label basique |
| `enterprise_l` | Exploitation avancée | custom domain, copro, white-label complet, account manager dédié |
| `enterprise_xl` | Grand compte | SSO, illimité, onboarding/formation inclus, SLA premium |

## 2. Configuration actuelle effective par forfait

### `gratuit`

- Limites dures.
- `tenant_portal` = `basic`
- `lease_generation` = `true`
- `signatures` = `true` mais quota `0`, donc disponible uniquement à l'unité.
- Pas de paiement en ligne.
- Pas d'open banking.
- Pas d'EDL digital.

Conclusion : le produit se comporte comme un plan de découverte avec quelques signaux trompeurs possibles sur les signatures, car la feature existe techniquement mais sans quota inclus.

### `starter`

- Premier vrai plan de monétisation.
- Paiement en ligne activé.
- `auto_reminders` = `email_basic`
- Toujours sans colocation, sans EDL, sans analytics, sans open banking.
- Autorise des biens supplémentaires payants.

Conclusion : `starter` est surtout un plan d'encaissement et de gestion simple, pas un vrai plan “gestion locative avancée”.

### `confort`

- Premier plan qui débloque les fonctions les plus visibles du produit owner.
- `open_banking_level` = `basic`
- `bank_reconciliation` = `true`
- `tenant_portal` = `advanced`
- `owner_reports` = `true`
- `edl_digital` = `true`
- `colocation` = `true`
- `multi_users` = `true`

Conclusion : `confort` est le vrai seuil fonctionnel du produit. En UX, il devrait être traité comme le premier plan “produit complet”.

### `pro`

- `open_banking_level` = `advanced`
- `auto_reminders_sms` = `true`
- `roles_permissions` = `true`
- `activity_log` = `true`
- `providers_management` = `true`
- `api_access` = `true`
- `api_access_level` = `read_write`
- `work_orders_planning` = `true`

Conclusion : `pro` n'est pas juste “plus de volume”, c'est une rupture d'usage orientée exploitation, équipe et opérations.

### `enterprise_s` à `enterprise_xl`

- Différences surtout sur :
  - volume
  - frais de paiement
  - signatures incluses
  - webhooks
  - multi-mandants
  - niveau de white-label
  - custom domain
  - copro
  - SSO
  - account manager
  - SLA

Conclusion : les Enterprise ne devraient pas partager la même UX de surface. `enterprise_s` n'est pas `enterprise_l`, et `enterprise_l` n'est pas `enterprise_xl`.

## 3. Divergences entre logique, API, pricing et UI

### 3.1 Divergence d'entitlements

`components/subscription/subscription-provider.tsx` considère qu'une feature est disponible si :

- valeur `true`
- ou chaîne différente de `none`

Mais `app/api/subscriptions/features/route.ts` vérifie principalement :

- `planFeatures[feature] === true`

Conséquence :

- `tenant_portal: "basic"`
- `open_banking_level: "basic" | "advanced" | "premium"`
- `auto_reminders: "email_basic"`

peuvent être interprétés différemment entre le front et l'API.

Risque :

- l'écran peut considérer une feature “active”
- alors qu'un endpoint ou un autre composant la considère “inactive”

### 3.2 Divergence marketing / pricing

La page `app/pricing/page.tsx` pousse fortement `-20% annuel`, mais `starter` est configuré à :

- `9€/mois`
- `90€/an`

Soit environ `-17%`, pas `-20%`.

Risque :

- promesse marketing inexacte
- perte de confiance sur la grille tarifaire

### 3.3 Divergence pricing / comparaison

La grille compare bien les 4 plans Enterprise dans la section cartes, mais le tableau comparatif détaillé s'arrête à :

- `gratuit`
- `starter`
- `confort`
- `pro`
- `enterprise_s`

Risque :

- `enterprise_m`, `enterprise_l` et `enterprise_xl` sont vendus sans comparaison détaillée lisible

### 3.4 Divergence upgrade / vocabulaire

`components/subscription/smart-paywall.tsx` et `components/layout/unified-fab.tsx` emploient souvent :

- `Premium`
- `Passer Pro`
- `Débloquer`

alors que le vrai plan requis peut être :

- `Confort`
- `Enterprise M`
- `Enterprise L`
- `Enterprise XL`

Risque :

- mauvais ciblage d'upsell
- confusion sur le bon plan
- friction d'achat

## 4. Cartographie UX/UI par écran

### Lecture

| Colonne | Sens |
| --- | --- |
| Variation actuelle | ce que fait le produit aujourd'hui |
| Variation attendue | ce que l'UX devrait faire si elle était vraiment plan-aware |
| Écart | niveau de problème |

### Matrice écrans owner

| Écran | Fichier principal | Plan minimum réel | Variation actuelle | Variation attendue | Écart |
| --- | --- | --- | --- | --- | --- |
| Navigation owner | `components/layout/AppShell.tsx` | variable selon entrée | aucune variation par plan, seulement par rôle | masquer, dégrader ou réordonner les entrées selon plan | très fort |
| FAB global | `components/layout/unified-fab.tsx` | variable | CTA générique `Passer Pro` pour tout le monde | CTA contextualisé par feature/plan requis | fort |
| Settings owner | `app/owner/settings/page.tsx` | variable | cartes identiques pour tous les owners | cartes contextualisées, locks ou parcours dédiés | très fort |
| Pricing public | `app/pricing/page.tsx` | n/a | bonne différenciation cartes, mais comparaison incomplète | cohérence complète entre cartes, tableau, CTA et checkout | moyen |
| Mon forfait | `app/owner/money/tabs/MonForfaitTab.tsx` | tous | bonne conscience du plan courant | devrait devenir la page pivot de guidance et migration plan | faible à moyen |
| Création bien | `app/owner/properties/new/NewPropertyClient.tsx` | selon quota | redirection après chargement si quota dépassé | blocage anticipé, message explicite avant entrée | fort |
| Liste biens | `app/owner/properties/page.tsx` | selon quota | même écran pour tous, CTA “Ajouter un bien” identique puis modal upgrade | CTA et guidance adaptés au plan et au surcoût bien | moyen |
| Création bail | `app/owner/leases/ContractsClient.tsx` | selon quota | même bouton “Créer un bail”, modal après clic si limite | état CTA différent selon plan et quota | moyen |
| Colocation | `app/owner/leases/new/ColocationConfig.tsx` | `confort` | contenu complet puis `PlanGate blur` | alternative simplifiée + upsell contextuel + explication usage | fort |
| Analytics owner | `app/owner/analytics/AnalyticsGate.tsx` | `confort` | blur | teaser plus orienté bénéfice et KPIs débloqués | moyen |
| IRL / indexation | `app/owner/indexation/IndexationGate.tsx` | `confort` | blur | guidance proactive depuis baux/finances | moyen |
| EDL | `app/owner/inspections/InspectionsClient.tsx` | `confort` | page quasi complète puis blur | différencier EDL papier vs EDL digital dès le haut de page | fort |
| Prestataires | `app/owner/providers/page.tsx` | `pro` | marketplace entière floutée | page d'attente orientée bénéfice, non catalogue simulé | fort |
| Travaux | `app/owner/work-orders/page.tsx` | `confort` | page quasi complète puis blur | vue read-only ou empty state plan-aware | moyen |
| Branding | `app/owner/settings/branding/page.tsx` | `enterprise_m` | no-access page dédiée, plus mature que d'autres | servir de modèle pour d'autres modules premium | faible |
| Copro | `app/owner/copro/CoproGate.tsx` | `enterprise_l` | blur | parcours Enterprise dédié avec positionnement clair | fort |

## 5. Réponse claire à la question “les UX/UI sont-elles identiques ?”

### Non, pas complètement

Il existe bien des différences de comportement :

- blur
- badge plan requis
- modal d'upgrade
- bannière de limite
- redirection après vérification
- no-access page dédiée

### Oui, trop au niveau structurel

Les différences sont encore insuffisantes sur :

- la navigation
- les CTA primaires
- la hiérarchie des écrans
- la densité d'information
- le vocabulaire
- les parcours d'entrée dans les modules premium

Conclusion produit :

Le système est aujourd'hui “permission-aware”, mais pas vraiment “experience-aware”.

## 6. Diagnostic UX global

### Ce qui fonctionne

- La source de vérité produit des plans est relativement claire.
- Le modèle de features est riche.
- Les limites d'usage sont déjà visibles dans plusieurs écrans.
- `MonForfaitTab` est la meilleure base actuelle pour une UX réellement plan-aware.
- Le branding a déjà une UX plus adaptée au niveau de forfait que le reste du produit.

### Ce qui ne fonctionne pas

- Trop d'écrans gardent la même structure quel que soit le plan.
- Trop de blocages arrivent après clic.
- Les CTA d'upgrade sont trop génériques.
- Les plans Enterprise sont sous-différenciés côté UX.
- Les nomenclatures `Premium`, `Pro`, `Enterprise` se chevauchent visuellement.
- Le plan `confort`, qui est le vrai seuil fonctionnel, n'est pas assez valorisé comme tel.

## 7. Priorisation des refontes

### Priorité 1

- `components/layout/AppShell.tsx`
- `app/owner/settings/page.tsx`
- `components/layout/unified-fab.tsx`
- `app/api/subscriptions/features/route.ts`

Objectif :

- rendre les droits cohérents
- arrêter de montrer la même architecture à tous les plans
- arrêter les CTA génériques

### Priorité 2

- `app/owner/properties/page.tsx`
- `app/owner/properties/new/NewPropertyClient.tsx`
- `app/owner/leases/ContractsClient.tsx`
- `app/owner/inspections/InspectionsClient.tsx`
- `app/owner/providers/page.tsx`

Objectif :

- rendre les parcours métier visibles différents avant interaction

### Priorité 3

- `app/pricing/page.tsx`
- `components/subscription/smart-paywall.tsx`
- `components/subscription/upgrade-modal.tsx`

Objectif :

- aligner marketing, upsell et logique réelle

### Priorité 4

- `app/owner/analytics/AnalyticsGate.tsx`
- `app/owner/indexation/IndexationGate.tsx`
- `app/owner/copro/CoproGate.tsx`
- `app/owner/leases/new/ColocationConfig.tsx`

Objectif :

- harmoniser les expériences premium locales

## 8. Recommandation cible

### Principe directeur

Passer de :

- “même interface pour tous, blocage local ensuite”

à :

- “interface déjà adaptée au plan, avec découverte progressive du niveau supérieur”

### Règles produit proposées

1. La navigation ne doit pas être identique entre `gratuit`, `starter`, `confort`, `pro` et `enterprise`.
2. Le CTA d'upgrade doit toujours nommer le vrai plan requis.
3. Toute feature à niveau string (`basic`, `advanced`, `full`) doit être interprétée de façon uniforme partout.
4. Les modules premium doivent choisir un pattern unique parmi :
   - hidden
   - teaser
   - read-only
   - blur
   - redirect
5. Les Enterprise doivent avoir une UX distincte, pas juste plus de quotas.

## 9. Patterns de gating actuellement utilisés

| Pattern actuel | Exemples | Lecture UX | Problème |
| --- | --- | --- | --- |
| `blur` | analytics, copro, providers, colocation, work-orders, EDL | l'utilisateur voit le module mais ne peut pas vraiment l'utiliser | frustration, illusion d'accès |
| `redirect après mount` | création de bien | le système laisse entrer puis renvoie | découverte trop tardive |
| `modal upgrade` | biens, baux, paywalls divers | upsell localisé mais souvent générique | manque de précision sur le plan requis |
| `no-access screen dédiée` | branding | expérience plus propre, plus honnête | pattern encore isolé |
| `banner quota` | biens, baux, forfait | bonne pédagogie sur l'usage | peu connectée à la structure globale |

### Pattern cible recommandé par module

| Type de module | Pattern recommandé |
| --- | --- |
| Module coeur mais limité par quota | bannière + CTA contextualisé + état CTA différent |
| Module premium différenciant | teaser dédié ou read-only, pas blur massif |
| Module Enterprise structurant | page d'atterrissage dédiée, pas simple overlay |
| Paramétrage non disponible | no-access screen dédiée |
| Action secondaire premium | badge + tooltip ou inline upsell contextualisé |

## 10. Backlog opérationnel par fichier

| Fichier | Action recommandée |
| --- | --- |
| `components/layout/AppShell.tsx` | rendre la navigation plan-aware, au moins sur owner |
| `components/layout/unified-fab.tsx` | remplacer `Passer Pro` par un CTA contextualisé |
| `app/owner/settings/page.tsx` | adapter les cartes settings au plan courant |
| `app/api/subscriptions/features/route.ts` | unifier la lecture des features booléennes et à niveaux |
| `components/subscription/smart-paywall.tsx` | supprimer les labels trop génériques `Premium` / `Pro` |
| `components/subscription/upgrade-modal.tsx` | afficher systématiquement le vrai plan requis et le bon wording |
| `app/pricing/page.tsx` | réaligner remises annuelles, comparaison Enterprise et CTA |
| `app/owner/properties/new/NewPropertyClient.tsx` | remplacer la redirection tardive par une pré-validation plus explicite |
| `app/owner/properties/page.tsx` | faire varier le CTA “Ajouter un bien” selon quota et plan |
| `app/owner/leases/ContractsClient.tsx` | faire varier le CTA “Créer un bail” selon quota et plan |
| `app/owner/providers/page.tsx` | remplacer le blur par une vraie page d'accès Pro |
| `app/owner/inspections/InspectionsClient.tsx` | séparer EDL digital premium et template papier accessible |
| `app/owner/copro/CoproGate.tsx` | construire une entrée Enterprise L dédiée |
| `app/owner/settings/branding/page.tsx` | réutiliser ce pattern de no-access screen ailleurs |

## 11. Conclusion

Le produit possède déjà une base d'entitlements solide, mais l'expérience utilisateur reste trop homogène et trop réactive, alors qu'elle devrait être proactive et structurée par plan.

Le principal problème n'est pas l'absence de logique de forfait.

Le principal problème est que cette logique n'est pas encore assez visible dans l'information architecture, les CTA, les parcours et la narration produit.
