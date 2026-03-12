# Simplification du tableau de bord Talok — Rapport et plan

**Date** : Mars 2026  
**Référence** : Plan « Simplifier Le Dashboard Talok » (user-first).

---

## 1. Diagnostic ciblé du dashboard owner et tenant

### 1.1 Dashboard propriétaire (owner)

**Fichier** : [app/owner/dashboard/DashboardClient.tsx](app/owner/dashboard/DashboardClient.tsx)

| Élément | Constat |
|--------|---------|
| **Points forts** | Les actions urgentes existent (impayés, signatures, EDL, tickets, factures à envoyer, DPE) et sont construites côté données. Le bloc `UrgentActionsSection` est pertinent. Les 4 KPI dans le header (revenus, biens, baux, taux d’occupation) donnent une vue synthétique. |
| **Points faibles** | Trop de sections affichées d’un coup : header riche, complétion profil, bannière push, alerte signatures, urgences, liens rapides (4 cartes), Performance financière (2 widgets dont temps réel), Portefeuille + conformité + risques + activité récente, puis usage limits + upgrade. L’utilisateur voit tout en scrollant sans hiérarchie claire. La « première action » n’est pas toujours évidente. |
| **Risque UX** | Charge cognitive élevée ; les urgences métier peuvent être noyées entre le header et les liens rapides. |

### 1.2 Dashboard locataire (tenant)

**Fichier** : [app/tenant/dashboard/DashboardClient.tsx](app/tenant/dashboard/DashboardClient.tsx)

| Élément | Constat |
|--------|---------|
| **Points forts** | Bloc onboarding (progression + checklist) très bon. `pendingActions` (signer bail, régulariser impayé, EDL, assurance) forme un vrai centre de commande. Carte « Situation financière » et carte « Logement » (bento) donnent le résumé utile. |
| **Points faibles** | En dessous : activité récente, Credit Builder, Consommation, Support bailleur, DPE, Conseil Tom. Beaucoup de blocs « SOTA » ou secondaires qui concurrencent le message principal (quoi faire maintenant + état du logement). |
| **Risque UX** | Premier écran lisible, mais le scroll révèle une accumulation (credit score, consommation, DPE, conseil IA) qui peut diluer la priorité. |

### 1.3 Synthèse diagnostic

- **Owner** : hiérarchie insuffisante ; les urgences et les 4 KPI sont noyés dans une longue page.
- **Tenant** : bonne base (onboarding + actions + résumé logement), mais trop de blocs avancés visibles d’emblée.
- **Principe manquant** : « Une seule promesse par écran » et « Une action primaire au-dessus de la ligne de flottaison ».

---

## 2. Nouvelle hiérarchie de contenu (user-first)

### 2.1 Niveaux visuels cibles

| Niveau | Rôle | Contenu |
|--------|------|---------|
| **Niveau 1** | Ce que je dois faire maintenant | 1 à 3 urgences max avec CTA directs (owner) ; actions en attente + checklist onboarding (tenant). |
| **Niveau 2** | État de mon portefeuille / logement | 4 KPI max (owner : biens, baux actifs, revenus du mois, impayés ou taux d’occupation) ; résumé logement + situation financière + documents importants (tenant). |
| **Niveau 3** | Détails, analyses, historique | Activité récente, liens rapides ; tout le reste (finances détaillées, conformité, risques, analytics, credit score, consommation, DPE, conseils IA) en secondaire ou repliable. |

### 2.2 Structure owner (4 zones visibles)

1. **Bandeau prioritaire** : 1 à 3 actions urgentes, CTA clairs.
2. **Résumé portefeuille** : 4 indicateurs (biens, baux actifs, loyers/revenus, impayés ou occupation).
3. **Tâches à terminer** : profil incomplet, documents manquants, onboarding, configuration paiement, alertes signatures / push (regroupés).
4. **Activité récente** : timeline courte.

**En secondaire (replié ou lien « Voir détails »)** : Performance financière (graphiques, temps réel), Portefeuille par module, Conformité / risques, Liens rapides (analytics, nouveau bail, ajouter un bien), Usage limits, Upgrade.

### 2.3 Structure tenant (4 zones visibles)

1. **Bloc action du moment** : Signer bail, Payer, EDL, Assurance, Identité (boutons d’action prioritaires).
2. **Résumé logement** : Bail actuel, adresse, loyer mensuel, statut (carte logement + situation financière).
3. **Mes documents importants** : Accès rapide quittance, bail, assurance, EDL (lien vers Documents).
4. **Activité récente** : Derniers événements (paiements, tickets).

**En secondaire (replié « En savoir plus »)** : Credit Builder, Consommation, DPE, Conseil Tom, Support bailleur (détails).

---

## 3. Blocs à garder, compacter, déplacer ou déprioriser

### 3.1 Owner

| Bloc actuel | Décision | Action |
|-------------|----------|--------|
| UrgentActionsSection | Garder | Monter en premier ; limiter à 3 actions affichées. |
| Header (titre + 4 KPI) | Garder, compacter | Rester juste après les urgences ; garder 4 KPI uniquement (sans surcharge visuelle). |
| ProfileCompletionCard | Garder | Dans « Tâches à terminer » (avec alertes). |
| PushNotificationPrompt | Garder | Inclure dans tâches ou garder une ligne. |
| SignatureAlertBanner | Garder | Inclure dans tâches. |
| Liens rapides (4 cartes) | Déplacer | Mettre dans la section repliée « Détails » ou sous activité. |
| Performance financière (RealtimeRevenue + OwnerFinanceSummary) | Déprioriser | Section repliable « Voir les détails financiers ». |
| OwnerPortfolioByModule, OwnerRiskSection | Déprioriser | Section repliable. |
| OwnerRecentActivity | Garder visible | Zone 4 « Activité récente » (courte). |
| UsageLimitBanner, UpgradeTrigger | Déprioriser | Section repliable ou en bas de page. |

### 3.2 Tenant

| Bloc actuel | Décision | Action |
|-------------|----------|--------|
| Onboarding (progression + checklist) | Garder | Rester en premier si onboarding incomplet. |
| pendingActions (boutons) | Garder | Centre de commande principal, juste après onboarding. |
| Situation financière + Carte logement (bento) | Garder | Résumé logement + loyer / impayé. |
| Activité récente | Garder | Zone « Activité » visible. |
| Credit Builder / CreditBuilderCard | Déprioriser | Section repliable « En savoir plus ». |
| Consommation (ConsumptionChart) | Déprioriser | Section repliable. |
| Support bailleur (carte) | Déprioriser | Section repliable ou lien dans résumé. |
| DPE | Déprioriser | Section repliable. |
| Conseil Tom (IA) | Déprioriser | Section repliable. |

---

## 4. Axes d’implémentation pour la refonte UX

### 4.1 Réalisé (implémentation actuelle)

- **Owner** : Urgent actions limitées à 3 ; ordre des sections : Bandeau prioritaire (urgences) → Résumé (header 4 KPI) → Tâches (profil + alertes) → Activité récente → Section repliable « Détails et analyses » (Liens rapides, Performance financière, Portefeuille & conformité, Usage / Upgrade).
- **Tenant** : Conservation de l’ordre onboarding → Command center (pendingActions) → Bento (finances + logement) → Activité ; section repliable « En savoir plus » (Credit Builder, Consommation, DPE, Conseil Tom, Support bailleur).

### 4.2 Fichiers modifiés

- [app/owner/dashboard/DashboardClient.tsx](app/owner/dashboard/DashboardClient.tsx) : réordonnancement des sections ; `urgentActions.slice(0, 3)` ; activité visible ; bloc « Détails et analyses » dans `Collapsible`.
- [app/tenant/dashboard/DashboardClient.tsx](app/tenant/dashboard/DashboardClient.tsx) : section « En savoir plus » avec `Collapsible` pour Credit Builder, Consommation, DPE, Conseil Tom, Support bailleur.
- [components/layout/owner-app-layout.tsx](components/layout/owner-app-layout.tsx) : en-tête allégé, recherche plus discrète, suppression des actions secondaires bruyantes du header, aide reléguée au grand écran.
- [components/layout/tenant-app-layout.tsx](components/layout/tenant-app-layout.tsx) : header plus contextuel, sous-texte d’orientation, dark mode limité au desktop pour garder un en-tête plus calme.

### 4.3 Principes à respecter ensuite

- Une seule action primaire visible au-dessus de la ligne de flottaison.
- Maximum 4 KPI sans scroll (owner).
- Maximum 3 urgences affichées (owner).
- Même structure mentale : Agir → Comprendre (résumé) → Consulter (détails repliés).

### 4.4 Métriques de succès

- Réduction du scroll pour voir la première action.
- Taux de clic sur les CTA urgents (à suivre via analytics).
- Feedback utilisateur sur la clarté du dashboard (enquête ou entretiens).
