# RAPPORT D'AUDIT — DASHBOARDS TALOK

**Date :** 04/03/2026 (mise a jour) — V1 : 11/02/2026
**Auditeur :** Claude Code — Audit UX/UI & Technique
**Stack :** Next.js 14+ (App Router), Supabase, TypeScript, Tailwind CSS, Netlify
**Version du code :** Branche principale
**Perimetre :** 9 dashboards + Generic Router (couverture complete)

---

## RESUME EXECUTIF

| Metrique | Valeur |
|---|---|
| **Nombre total de bugs trouves** | **50** |
| Critiques | 8 |
| Majeurs | 16 |
| Mineurs | 18 |
| Cosmetiques | 8 |
| **Dashboards audites** | **9 (+ Generic Router)** |
| **Score UX moyen** | **5.9/10** |
| **Donnees connectees (Supabase)** | **~60% des widgets** |
| **Donnees 100% mockees** | Copro (entier), Admin (graphiques), Agency (Performance Card), Syndic (stats + alertes) |

### Repartition par dashboard

| Dashboard | Bugs | Score UX | Score UI | Donnees connectees | DataProvider | Realtime |
|---|---|---|---|---|---|---|
| Proprietaire | 12 | 7.5/10 | 8/10 | ~90% | Oui | Oui (8 canaux) |
| Locataire | 10 | 7.5/10 | 8/10 | ~85% | Oui | Oui (6 canaux) |
| Prestataire | 5 | 6/10 | 6.5/10 | ~80% | Non | Oui (3 canaux) |
| Admin | 6 | 6.5/10 | 8/10 | ~60% | Non | Non |
| Agence | 5 | 6/10 | 7.5/10 | ~70% | Non | Non |
| Syndic | 6 | 5.5/10 | 7/10 | ~30% | Non | Non |
| Coproprietaire | 4 | 4/10 | 7/10 | **0%** | Non | Non |
| Garant | 2 | 5/10 | 6/10 | ~90% | Non | Non |
| Router generique | 0 | N/A | N/A | N/A | N/A | N/A |

### Matrice architecturale

| Dashboard | Rendering | Data Source | Cache | Animations | Onboarding |
|---|---|---|---|---|---|
| Proprietaire | Server → Client | RPC + API + Realtime | React Query 2min | Framer Motion | Oui |
| Locataire | Server → Client | RPC + API + Realtime | React Query | Framer Motion | Oui |
| Prestataire | "use client" | API fetch + Realtime | Aucun | Framer Motion | Non |
| Admin | Server → Client | RPC admin_stats | Aucun | Framer Motion | Non |
| Agence | Server → Client (Suspense) | RPC agency_dashboard | Aucun | Framer Motion | Non |
| Syndic | "use client" | REST fetch + placeholder | Aucun | Framer Motion | Oui |
| Coproprietaire | "use client" | **Mock hardcode** | Aucun | Framer Motion | Non |
| Garant | "use client" | Service class (apiClient) | Aucun | Aucun | Non |
| Router | Server | getServerProfile + redirect | N/A | N/A | N/A |

---

## DASHBOARD PROPRIETAIRE (`/owner/dashboard`)

### Architecture

- **Server Component :** `app/owner/dashboard/page.tsx` — Authentification, fetch profile completion, passe les donnees au client
- **Client Component :** `app/owner/dashboard/DashboardClient.tsx` (537 lignes) — Rendu principal avec Framer Motion
- **Data Provider :** `app/owner/_data/OwnerDataProvider.tsx` — Context React pour eviter le refetch
- **API Route :** `app/api/owner/dashboard/route.ts` (~550 lignes) — Requetes Supabase paralleles, cache 5min
- **Hooks :** `use-dashboard.ts` (React Query, staleTime 2min), `use-realtime-dashboard.ts` (subscriptions Supabase)

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : KPI Proprietes (nombre de biens)
```
Widget: KPI Proprietes (total, active, draft)
Source: Supabase — table "properties" filtree par owner_id
Filtre applique: oui — eq("owner_id", ownerId)
RLS respecte: oui — policy "Owners can view own properties"
Etat vide gere: oui — EmptyState "Ajouter un bien" si 0 propriete
Bug identifie: aucun
```

#### Widget : KPI Baux (taux d'occupation)
```
Widget: KPI Baux (total, active, pending)
Source: Supabase — table "leases" avec join sur properties
Filtre applique: oui — in("property_id", propertyIds)
RLS respecte: oui — filtre par property_id du proprietaire
Etat vide gere: oui — affiche 0 si aucun bail
Bug identifie: aucun
```

#### Widget : KPI Factures (loyers encaisses/impayes)
```
Widget: KPI Factures (total, paid, pending, late)
Source: Supabase — table "invoices" filtree par owner_id + periode
Filtre applique: oui — eq("owner_id", ownerId) + gte(period, sixMonthsAgo)
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

#### Widget : KPI Tickets
```
Widget: KPI Tickets (total, open, in_progress)
Source: Supabase — table "tickets" filtree par property_id
Filtre applique: oui — in("property_id", propertyIds)
RLS respecte: oui
Etat vide gere: oui — 0 affiche
Bug identifie: aucun
```

#### Widget : Revenus du mois (OwnerFinanceSummary)
```
Widget: Resume financier (collected, expected, arrears)
Source: Supabase — calcul dynamique depuis invoices
Filtre applique: oui — par owner_id et mois courant
RLS respecte: oui
Etat vide gere: oui — skeleton fallback quand donnees manquantes
Bug identifie: mineur — chart_data vide rend un graphique blanc, pas de fallback explicite
```

#### Widget : Revenus temps reel (RealtimeRevenueWidget)
```
Widget: Revenus live + evenements recents
Source: Supabase Realtime — subscriptions sur payments, invoices, signers, tickets, leases
Filtre applique: oui — par owner_id, property_ids
RLS respecte: oui — les subscriptions Supabase respectent le RLS
Etat vide gere: oui — indicateur connecte/deconnecte, 0 si pas d'evenements
Bug identifie: mineur — key={totalRevenue} sur motion.div cause des re-mounts inutiles
```

#### Widget : Actions urgentes (UrgentActionsSection)
```
Widget: Liste des actions prioritaires (impayes, signatures, tickets)
Source: Supabase — construit dynamiquement depuis les KPIs du dashboard
Filtre applique: oui — herite des filtres du dashboard
RLS respecte: oui
Etat vide gere: oui — carte de celebration "Tout est en ordre"
Bug identifie: aucun
```

#### Widget : Activite recente (OwnerRecentActivity)
```
Widget: Feed d'activite recente
Source: DONNEES MANQUANTES — recentActivity toujours vide ([]) dans l'API
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: oui — "Aucune activite recente"
Bug identifie: CRITIQUE — le widget ne recoit jamais de donnees, toujours vide
```

#### Widget : Portfolio par module (OwnerPortfolioByModule)
```
Widget: Repartition par type (habitation, LCD, pro, parking)
Source: Supabase — construit depuis les proprietes et baux
Filtre applique: oui — par owner_id
RLS respecte: oui
Etat vide gere: oui — CTA "Ajouter un bien"
Bug identifie: mineur — un seul module "habitation" construit meme si types differents existent
```

#### Widget : Risques & Conformite (OwnerRiskSection)
```
Widget: Alertes DPE expirantes, baux arrivant a echeance
Source: Supabase — calcul dynamique depuis properties.dpe_date_expiration et leases.date_fin
Filtre applique: oui — par property_id du proprietaire
RLS respecte: oui
Etat vide gere: oui — carte verte "Aucun risque"
Bug identifie: mineur — les calculs DPE echouent silencieusement (try-catch vide, lignes 431-462 de l'API)
```

#### Widget : Completion du profil (ProfileCompletionCard)
```
Widget: Progression du profil (taches a completer)
Source: Supabase — tables profiles, owner_profiles, properties, leases, documents
Filtre applique: oui — par user_id et profile_id
RLS respecte: oui (utilise service_role pour le fetch server-side)
Etat vide gere: oui — trophee si 100%, sinon liste de taches
Bug identifie: mineur — @ts-nocheck dans fetchProfileCompletion.ts, 6 requetes separees au lieu de 1-2
```

#### Widget : Signature Alert Banner
```
Widget: Banniere alertes signatures en attente
Source: Supabase — API /api/owner/pending-signatures
Filtre applique: oui — par profil proprietaire
RLS respecte: oui
Etat vide gere: oui — banniere masquee si 0 signatures
Bug identifie: mineur — utilise toLocaleString('fr-FR') au lieu de formatCurrency()
```

#### Widget : Section Todos (OwnerTodoSection)
```
Widget: Liste des taches a realiser
Source: DONNEES NON MAPPEES — le composant attend "todos" mais l'API retourne "zone1_tasks"
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: oui — "Rien a faire"
Bug identifie: MAJEUR — les props ne correspondent pas a la structure API, composant jamais rempli correctement
```

**Formatage financier :** `formatCurrency()` produit `1 234,56 EUR` — format francais correct avec espace comme separateur de milliers et virgule decimale.

**Formatage dates :** `formatDateShort()` produit `JJ/MM/AAAA` — format francais correct. `formatDate()` produit `JJ mois AAAA` (ex: "4 avril 1992"). Gestion correcte des fuseaux horaires avec normalisation a midi.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #01**
```
Localisation: Dashboard Proprietaire > Activite recente
Description: Le widget recentActivity est toujours vide — l'API retourne un tableau vide []
Comportement attendu: Afficher les dernieres actions (factures, tickets, signatures)
Severite: CRITIQUE
Solution: Implementer le tracking d'activite dans /api/owner/dashboard (aggreger depuis invoices, tickets, lease_signers)
```

**Bug #02**
```
Localisation: Dashboard Proprietaire > Section Todos
Description: Le composant OwnerTodoSection attend une prop "todos" mais l'API fournit "zone1_tasks" avec une structure differente
Comportement attendu: Afficher les taches prioritaires (impayes, signatures, etc.)
Severite: MAJEUR
Solution: Aligner les props du composant avec la structure API ou creer un mapper
```

**Bug #03**
```
Localisation: Dashboard Proprietaire > page.tsx (Server Component)
Description: Aucun try-catch autour du fetch profil — une erreur Supabase propage une exception non geree
Comportement attendu: Gestion gracieuse de l'erreur avec redirection ou message
Severite: MAJEUR
Solution: Ajouter try-catch avec fallback vers la page d'erreur
```

**Bug #04**
```
Localisation: Dashboard Proprietaire > API route > DPE compliance
Description: Les calculs DPE echouent silencieusement (try-catch vide lignes 431-462)
Comportement attendu: Logger l'erreur, retourner les alertes quand meme ou un etat partiel
Severite: MAJEUR
Solution: Ajouter un logging et une degradation gracieuse
```

**Bug #05**
```
Localisation: Dashboard Proprietaire > fetchProfileCompletion.ts
Description: Fichier commence par @ts-nocheck — aucune verification TypeScript
Comportement attendu: Types verifies pour prevenir les erreurs a l'execution
Severite: MINEUR
Solution: Retirer @ts-nocheck et corriger les erreurs de type
```

**Bug #06**
```
Localisation: Dashboard Proprietaire > fetchProfileCompletion.ts
Description: 6 requetes Supabase separees au lieu d'un batch (profiles, owner_profiles, entities, properties, leases, documents)
Comportement attendu: 1-2 requetes optimisees avec JOIN
Severite: MINEUR (performance)
Solution: Consolider les requetes en utilisant des JOINs ou un RPC
```

**Bug #07**
```
Localisation: Dashboard Proprietaire > RealtimeRevenueWidget
Description: key={totalRevenue} sur motion.div cause des re-mounts a chaque changement de revenu
Comportement attendu: Animation fluide sans re-mount du composant
Severite: MINEUR
Solution: Utiliser un identifiant stable ou retirer la key dynamique
```

**Bug #08**
```
Localisation: Dashboard Proprietaire > DashboardClient.tsx lignes 232-243 et 283-294
Description: Les alertes compliance sont construites deux fois (zone3_portfolio.compliance)
Comportement attendu: Construction unique, reutilisation
Severite: MINEUR
Solution: Factoriser la logique de construction des alertes
```

**Bug #09**
```
Localisation: Dashboard Proprietaire > SignatureAlertBanner
Description: Utilise toLocaleString('fr-FR') au lieu de formatCurrency() pour le montant du loyer
Comportement attendu: Formatage coherent avec le reste de l'application
Severite: COSMETIQUE
Solution: Remplacer par formatCurrency()
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — Skeleton loaders + lazy loading des composants lourds (Recharts) |
| Animations de transition | Oui — Framer Motion avec stagger effect (containerVariants, itemVariants) |
| Hierarchie visuelle | Oui — KPIs en haut, actions urgentes, finances, portfolio, risques |
| Parcours utilisateur | Oui — Actions principales en 1-2 clics max |
| Etats de chargement | Oui — loading, error, empty, success geres |
| Feedback utilisateur | Partiel — toasts sur paiements temps reel, mais pas de spinner sur les boutons |
| Navigation entre sections | Oui — liens directs vers chaque section |
| Actions rapides | Non visible — pas de section quick actions dediee sur le dashboard owner |
| Onboarding jour 1 | Oui — EmptyState avec CTA "Ajouter un bien" + ProfileCompletionCard |

**Score UX : 7.5/10**

**Justification :** Architecture solide avec lazy loading, animations fluides, et bonne gestion des etats. Points negatifs : activite recente jamais remplie (-1), section todos cassee (-0.5), pas de bouton rafraichir manuel (-0.5), pas de section quick actions dediee (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — xs (320px), sm (640px), lg (1024px) avec grilles adaptatives |
| Grille coherente | Oui — grid-cols-1/2/3/4 selon breakpoints |
| Typographie hierarchisee | Oui — titres text-2xl/3xl, sous-titres text-lg, corps text-sm |
| Couleurs design system | Oui — variables CSS (--primary, --muted, etc.) |
| Icones coherentes | Oui — lucide-react exclusivement |
| Contraste WCAG AA | Oui — couleurs foreground/background respectent le ratio |
| Espacement regulier | Oui — gap-4/6, p-4/6, spacing coherent |
| Dark mode | Oui — classes dark: utilisees, theme toggle disponible |
| Graphiques lisibles | Partiel — Recharts avec lazy load mais chart_data souvent vide |
| SOTA 2026 | Oui — GlassCard, AnimatedCounter, StatusBadge, gradients modernes |

**Score UI : 8/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| Cache API | Oui — Cache-Control: private, s-maxage=300, stale-while-revalidate=60 |
| Requetes optimisees | Oui — Promise.all pour requetes paralleles dans l'API |
| Lazy loading composants | Oui — dynamic() pour Recharts, ProfileCompletionCard, etc. |
| React Query cache | Oui — staleTime 2min, gcTime 10min, refetchOnWindowFocus |
| Realtime | Oui — subscriptions Supabase sur 5 tables |
| N+1 queries | Non — requetes batch avec in() et JOINs |
| Re-renders inutiles | Partiel — key={totalRevenue} cause des re-mounts |
| Images optimisees | Non applicable — peu d'images sur le dashboard |

---

## DASHBOARD LOCATAIRE (`/tenant/dashboard`)

### Architecture

- **Server Component :** `app/tenant/dashboard/page.tsx` — Fetch des EDL en attente
- **Client Component :** `app/tenant/dashboard/DashboardClient.tsx` (870 lignes) — Layout Bento Grid
- **Data Provider :** `app/tenant/_data/TenantDataProvider.tsx` — Context React
- **Data Fetch :** `app/tenant/_data/fetchTenantDashboard.ts` — RPC `tenant_dashboard`
- **API Routes :** `/api/tenant/credit-score`, `/api/tenant/consumption`
- **Hook :** `use-realtime-tenant.ts` (586 lignes) — 6 canaux temps reel

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : Carte financiere (loyer + charges)
```
Widget: Statut financier (loyer mensuel, impayes)
Source: Supabase — RPC tenant_dashboard + realtime hook
Filtre applique: oui — p_tenant_user_id dans le RPC
RLS respecte: oui — RPC avec SECURITY DEFINER
Etat vide gere: oui — "— EUR" si pas de bail
Bug identifie: aucun
```

#### Widget : Carte du logement (propriete)
```
Widget: Informations du logement (adresse, image, type de bail)
Source: Supabase — RPC tenant_dashboard (lease.property)
Filtre applique: oui — par tenant user_id
RLS respecte: oui
Etat vide gere: oui — "Pas encore de logement" + CTA "Lier mon logement"
Bug identifie: mineur — pas de fallback si cover_url de l'image est casse
```

#### Widget : Credit Builder (score de confiance)
```
Widget: Score locataire (300-850), facteurs, tendance
Source: Supabase — API /api/tenant/credit-score (calcul dynamique)
Filtre applique: oui — role check + lease_signers par profile_id
RLS respecte: oui — 403 si role != tenant
Etat vide gere: oui — icone cadenas "Connectez-vous a un bail actif"
Bug identifie: mineur — le calcul de "change" est simplifie (ne regarde que la derniere facture)
```

#### Widget : Graphique consommation (compteurs)
```
Widget: Consommation electricite/eau/gaz (6 mois)
Source: Supabase — API /api/tenant/consumption (EDL items)
Filtre applique: oui — par property_id du bail actif
RLS respecte: oui
Etat vide gere: oui — "Aucun releve disponible"
Bug identifie: mineur — depend des EDL, donc donnees potentiellement lacunaires
```

#### Widget : Feed d'activite
```
Widget: Activite recente (factures, tickets, evenements realtime)
Source: Supabase — agrege invoices + tickets + realtime events
Filtre applique: oui — par lease_id et profile_id
RLS respecte: oui
Etat vide gere: oui — "Aucune activite"
Bug identifie: mineur — deduplication pourrait rater des mises a jour si meme ID
```

#### Widget : Carte proprietaire
```
Widget: Infos du proprietaire (nom, avatar)
Source: Supabase — RPC tenant_dashboard (lease.owner)
Filtre applique: oui — via le bail actif
RLS respecte: oui
Etat vide gere: oui — "Pas encore de proprietaire"
Bug identifie: MAJEUR — le bouton telephone n'a pas de onClick handler, non fonctionnel
```

#### Widget : Conseil IA
```
Widget: Conseil personnalise (assurance, etc.)
Source: DONNEES HARDCODEES — message statique sur l'assurance
Filtre applique: non — meme message pour tous les locataires
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: CRITIQUE — contenu entierement hardcode, pas de personnalisation
```

#### Widget : Onboarding Progress
```
Widget: Barre de progression d'onboarding
Source: Supabase — calcul dynamique depuis lease, KYC status, signatures
Filtre applique: oui — par user authentifie
RLS respecte: oui
Etat vide gere: oui — masque si onboarding complete
Bug identifie: mineur — step 3 "Dossier locataire" marque TODO, jamais verifie
```

**Formatage financier :** Utilise `formatCurrency()` du helper partage — format francais correct.

**Formatage dates :** Utilise `formatDateShort()` — format JJ/MM/AAAA correct.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #10**
```
Localisation: Dashboard Locataire > Conseil IA (carte en bas)
Description: Le contenu est entierement hardcode — meme message "assurance" pour tous les locataires
Comportement attendu: Conseil dynamique base sur le statut reel de l'utilisateur
Severite: CRITIQUE
Solution: Interroger les donnees utilisateur et generer un conseil contextuel
```

**Bug #11**
```
Localisation: Dashboard Locataire > Carte proprietaire > Bouton telephone
Description: Le bouton <Phone> n'a ni onClick handler ni href="tel:..." — visuellement present mais non fonctionnel
Comportement attendu: Appel ou lien vers la fiche contact du proprietaire
Severite: MAJEUR
Solution: Ajouter href="tel:{phone}" ou onClick pour ouvrir la messagerie
```

**Bug #12**
```
Localisation: Dashboard Locataire > Detection suppression propriete
Description: Verification (currentProperty as any)?.estate === "deleted" — "estate" devrait etre "etat"
Comportement attendu: La banniere de suppression s'affiche quand la propriete est supprimee
Severite: MAJEUR
Solution: Corriger le nom de la propriete en "etat" ou "deleted_at"
```

**Bug #13**
```
Localisation: Dashboard Locataire > Paiement > Modal
Description: Apres un paiement reussi, window.location.reload() force un rechargement complet
Comportement attendu: Mise a jour d'etat React sans rechargement de page
Severite: MAJEUR
Solution: Utiliser invalidateQueries() ou setState pour rafraichir les donnees
```

**Bug #14**
```
Localisation: Dashboard Locataire > Onboarding progress
Description: L'etape 3 "Dossier locataire" est commentee TODO — jamais incrementee
Comportement attendu: Verification du depot de documents
Severite: MINEUR
Solution: Implementer la verification ou retirer l'etape du calcul
```

**Bug #15**
```
Localisation: Dashboard Locataire > Multi-bail
Description: Le state selectedLeaseIndex existe mais aucun UI de selection n'est rendu
Comportement attendu: Dropdown ou tabs pour changer de bail si le locataire en a plusieurs
Severite: MINEUR
Solution: Ajouter un selecteur de bail si la fonctionnalite est souhaitee
```

**Bug #16**
```
Localisation: Dashboard Locataire > fetchTenantDashboard.ts
Description: Verification de la chaine "undefined" dans owner.name — indique un bug en amont
Comportement attendu: Les donnees ne devraient jamais contenir la chaine "undefined"
Severite: MINEUR
Solution: Corriger la source (RPC ou jointure) pour ne pas generer "undefined" en nom
```

**Bug #17**
```
Localisation: Dashboard Locataire > DashboardClient.tsx
Description: Multiples assertions de type "any" (currentLease as any, currentProperty as any)
Comportement attendu: Types TypeScript stricts
Severite: COSMETIQUE
Solution: Definir des interfaces appropriees
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — Skeletons + Suspense boundaries |
| Animations de transition | Oui — Framer Motion AnimatePresence |
| Hierarchie visuelle | Oui — Onboarding > Command Center > Bento Grid |
| Parcours utilisateur | Oui — Actions en 1-2 clics (payer, signaler, etc.) |
| Etats de chargement | Oui — loading, error, empty, success |
| Feedback utilisateur | Partiel — toasts realtime, mais reload apres paiement |
| Navigation fluide | Oui — liens directs vers chaque section |
| Actions rapides | Oui — Command Center avec actions contextuelles |
| Onboarding jour 1 | Oui — barre de progression + etapes guidees |

**Score UX : 7.5/10**

**Justification :** Excellent design Bento Grid avec realtime, command center contextuels, et bon onboarding. Points negatifs : conseil IA hardcode (-1), bouton telephone non fonctionnel (-0.5), reload apres paiement (-0.5), multi-bail sans UI (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — Bento Grid responsive (1/2/3 colonnes) |
| Grille coherente | Oui — grid avec col-span-4/8 sur 12 colonnes |
| Typographie hierarchisee | Oui — tailles coherentes |
| Couleurs design system | Oui — variables CSS du design system |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Oui |
| Espacement regulier | Oui |
| Dark mode | Oui — classes dark: presentes |
| Graphiques lisibles | Oui — Recharts AreaChart avec gradient |
| SOTA 2026 | Oui — GlassCard, OptimizedImage, StatusBadge, animations |

**Score UI : 8/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| RPC optimise | Oui — tenant_dashboard() unique pour les donnees principales |
| APIs secondaires | Oui — credit-score et consumption charges en async client-side |
| Realtime | Oui — 6 canaux (leases, invoices, documents, tickets, signers, properties) |
| Lazy loading | Partiel — pas de dynamic() pour les composants lourds |
| Re-renders | Partiel — useMemo utilise extensivement, certains inutiles |
| Deduplication | Oui — Set pour dedupliquer les evenements |

---

## DASHBOARD PRESTATAIRE (`/provider/dashboard`)

### Architecture

- **Client Component :** `app/provider/dashboard/page.tsx` (397 lignes) — "use client" avec useEffect
- **Composant alternatif :** `VendorDashboardClient.tsx` (252 lignes) — **INUTILISE**
- **Layout :** `app/provider/layout.tsx` (186 lignes) — Auth server-side + responsive nav
- **API Route :** `app/api/provider/dashboard/route.ts` (59 lignes) — RPC `provider_dashboard`
- **Pas de hook realtime** — pas de subscriptions Supabase

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : KPI Interventions totales
```
Widget: Compteur interventions (total + completed + progress bar)
Source: Supabase — RPC provider_dashboard
Filtre applique: oui — p_user_id dans le RPC
RLS respecte: oui — verification role "provider" dans l'API
Etat vide gere: oui — affiche 0 avec progress bar a 0%
Bug identifie: aucun
```

#### Widget : KPI En attente
```
Widget: Nombre d'interventions en attente
Source: Supabase — RPC provider_dashboard (pending_interventions)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

#### Widget : KPI Chiffre d'affaires
```
Widget: Total facture en EUR
Source: Supabase — RPC provider_dashboard (total_revenue)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0,00 EUR
Bug identifie: aucun
```

#### Widget : KPI Note moyenne
```
Widget: Note sur 5 + nombre d'avis
Source: Supabase — RPC provider_dashboard (avg_rating, total_reviews)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche "—" si null
Bug identifie: aucun
```

#### Widget : Interventions a venir
```
Widget: Liste des ordres en attente (titre, adresse, date, cout)
Source: Supabase — RPC provider_dashboard (pending_orders)
Filtre applique: oui — par provider_id
RLS respecte: oui
Etat vide gere: oui — icone CheckCircle2 + "Aucune intervention en attente"
Bug identifie: MAJEUR — bouton "Contacter" sans onClick handler (ligne 302-305)
```

#### Widget : Avis recents
```
Widget: Derniers avis clients (nom, note, commentaire, date)
Source: Supabase — RPC provider_dashboard (recent_reviews)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — icone Star + "Aucun avis pour le moment"
Bug identifie: MINEUR — pas de null-check sur review.reviewer (ligne 341)
```

#### Widget : Actions rapides
```
Widget: 4 boutons (Devis, Calendrier, Factures, Documents)
Source: Liens statiques (pas de donnees)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: aucun
```

**Formatage financier :** Fonction locale `formatCurrency()` — identique au helper global. Format francais correct.

**Formatage dates :** Fonction locale `formatDate()` avec `month: "short"` — produit "5 janv. 2025" au lieu de "05/01/2025". Inconsistance avec les autres dashboards qui utilisent le format JJ/MM/AAAA.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #18**
```
Localisation: Dashboard Prestataire > Interventions > Bouton "Contacter"
Description: Le bouton <Phone> Contacter n'a pas de onClick handler ni de lien
Comportement attendu: Contacter le proprietaire ou le locataire associe a l'intervention
Severite: MAJEUR
Solution: Ajouter un handler de contact (tel:, messagerie, ou dialog)
```

**Bug #19**
```
Localisation: Dashboard Prestataire > VendorDashboardClient.tsx
Description: Composant de 252 lignes qui n'est importe nulle part — code mort
Comportement attendu: Utilise ou supprime
Severite: MINEUR
Solution: Supprimer le fichier ou l'integrer dans le dashboard
```

**Bug #20**
```
Localisation: Dashboard Prestataire > VendorDashboardClient.tsx ligne 2
Description: @ts-nocheck desactive toute verification TypeScript
Comportement attendu: Types verifies
Severite: MINEUR
Solution: Retirer @ts-nocheck ou supprimer le fichier
```

**Bug #21**
```
Localisation: Dashboard Prestataire > Avis recents (ligne 341)
Description: review.reviewer.prenom acces sans null-check — crash si reviewer est null
Comportement attendu: Afficher un nom par defaut si reviewer manquant
Severite: MINEUR
Solution: Ajouter review.reviewer?.prenom || "Anonyme"
```

**Bug #22**
```
Localisation: Dashboard Prestataire > page.tsx
Description: Pas de bouton de rafraichissement — les donnees sont chargees une seule fois au mount
Comportement attendu: Possibilite de rafraichir manuellement
Severite: MINEUR
Solution: Ajouter un bouton refresh ou utiliser React Query avec refetch
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — Skeleton UI adapte |
| Animations de transition | NON — aucune animation Framer Motion |
| Hierarchie visuelle | Oui — Stats > Contenu > Actions rapides |
| Parcours utilisateur | Basique — liens directs vers les sections |
| Etats de chargement | Oui — loading, error, empty geres |
| Feedback utilisateur | NON — pas de toasts, pas de spinner sur boutons |
| Navigation fluide | Oui — liens corrects |
| Actions rapides | Oui — 4 boutons en bas |
| Onboarding jour 1 | NON — aucun guide ou CTA d'onboarding |

**Score UX : 6/10**

**Justification :** Dashboard fonctionnel mais basique comparee aux dashboards Proprietaire et Locataire. Pas d'animations (-1), pas de temps reel (-1), pas de feedback utilisateur (-0.5), pas d'onboarding (-1), bouton Contacter non fonctionnel (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-1 / md:grid-cols-4 / lg:grid-cols-2 |
| Grille coherente | Oui — mais basique (pas de Bento Grid) |
| Typographie hierarchisee | Oui — text-2xl/3xl, text-lg, text-sm |
| Couleurs design system | Partiel — utilise les composants UI mais pas de GlassCard/gradient |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Oui |
| Espacement regulier | Oui — space-y-6, gap-4 |
| Dark mode | Partiel — utilise les variables CSS mais pas teste |
| Graphiques lisibles | NON — aucun graphique, seulement une progress bar |
| SOTA 2026 | NON — design basique sans effets visuels modernes |

**Score UI : 6.5/10**

**Justification :** UI fonctionnelle et propre mais nettement en dessous du niveau des autres dashboards. Pas de GlassCard (-0.5), pas de gradients (-0.5), pas de graphiques (-1), design Cards basique (-0.5), pas de Bento Grid layout (-1).

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| RPC optimise | Oui — une seule requete RPC |
| Client-side fetch | useEffect + fetch — pas de React Query |
| Cache | NON — pas de cache cote client, pas de staleTime |
| Realtime | NON — aucune subscription |
| Lazy loading | NON — tous les composants charges immediatement |
| AbortController | NON — pas de cleanup sur le useEffect |
| Re-renders | Bien — peu de state, pas de re-renders inutiles |

---

## DASHBOARD ADMIN (`/admin/dashboard`)

### Architecture

- **Server Component :** `app/admin/dashboard/page.tsx` (17 lignes) — force-dynamic, fetch stats, passe au client
- **Client Component :** `app/admin/dashboard/DashboardClient.tsx` (422 lignes) — "use client" + @ts-nocheck
- **Client Component V2 :** `app/admin/dashboard/DashboardClientV2.tsx` (27KB) — **INUTILISE, jamais importe**
- **Data Fetch :** `app/admin/_data/fetchAdminStats.ts` — RPC `admin_stats`
- **Pas de DataProvider** — donnees passees en props directes
- **Pas de hook realtime** — aucune subscription Supabase

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : KPI Utilisateurs
```
Widget: Compteur utilisateurs + sparkline + trend
Source: Supabase — RPC admin_stats (totalUsers, usersByRole)
Filtre applique: oui — role admin verifie dans fetchAdminStats
RLS respecte: oui — redirect si non authentifie
Etat vide gere: oui — affiche 0
Bug identifie: MAJEUR — trend { value: 12, direction: "up" } hardcode (ligne 115), sparklineData = Math.random() (ligne 116)
```

#### Widget : KPI Logements
```
Widget: Compteur proprietes + sparkline
Source: Supabase — RPC admin_stats (totalProperties)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: MAJEUR — trend { value: 5, direction: "up" } hardcode (ligne 127), sparkline aleatoire
```

#### Widget : KPI Baux actifs
```
Widget: Compteur baux actifs / total
Source: Supabase — RPC admin_stats (activeLeases, totalLeases)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: MAJEUR — trend { value: 3, direction: "up" } hardcode (ligne 139), sparkline aleatoire
```

#### Widget : KPI Tickets ouverts
```
Widget: Compteur tickets ouverts avec couleur conditionnelle
Source: Supabase — RPC admin_stats (openTickets, totalTickets)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui
Bug identifie: MINEUR — trend calcule depuis openTickets > 5 mais valeur hardcodee (8 ou -5)
```

#### Widget : Graphique evolution des revenus (AreaChartCard)
```
Widget: Courbe loyers attendus vs encaisses sur 12 mois
Source: DONNEES ALEATOIRES — generateMonthlyData() utilise Math.random() (lignes 48-55)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: CRITIQUE — donnees 100% generees aleatoirement a chaque render, pas de source Supabase
```

#### Widget : Jauges Performance (RadialProgress)
```
Widget: Taux d'occupation et taux de recouvrement
Source: Supabase — calcul dynamique depuis stats (activeLeases/totalProperties, invoices)
Filtre applique: oui — herite des stats
RLS respecte: oui
Etat vide gere: oui — affiche 0%
Bug identifie: aucun
```

#### Widget : Donut Chart repartition utilisateurs
```
Widget: Repartition par role (owner, tenant, provider, admin)
Source: Supabase — RPC admin_stats (usersByRole)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — donut vide
Bug identifie: aucun
```

#### Widget : Bar Chart baux par statut
```
Widget: Baux actifs/en attente/brouillons/termines
Source: Supabase — RPC admin_stats (leasesByStatus)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — barres a 0
Bug identifie: aucun
```

#### Widget : Facturation (stats detaillees)
```
Widget: Factures payees/en attente/en retard + total
Source: Supabase — RPC admin_stats (invoicesByStatus, totalInvoices)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

#### Widget : Activite recente
```
Widget: Feed d'activite avec icones par type (user, property, lease, payment)
Source: Supabase — RPC admin_stats (recentActivity: any[])
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — icone FolderOpen "Aucune activite recente"
Bug identifie: MINEUR — type any[] dans l'interface (ligne 26 de fetchAdminStats.ts), pas de typage strict
```

#### Widget : Footer stats (Documents, Articles, Prestataires, Admins)
```
Widget: 4 compteurs en grille
Source: Supabase — RPC admin_stats (totalDocuments, publishedBlogPosts, usersByRole)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

**Formatage financier :** Utilise `formatCurrency()` du helper partage — format francais correct.

**Formatage dates :** Utilise `formatDateShort()` du helper partage — format JJ/MM/AAAA correct.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #28**
```
Localisation: Dashboard Admin > DashboardClient.tsx ligne 2
Description: @ts-nocheck desactive toute verification TypeScript sur 420 lignes de code
Comportement attendu: Types verifies pour prevenir les erreurs a l'execution
Severite: MAJEUR
Solution: Retirer @ts-nocheck et corriger les erreurs de type
```

**Bug #29**
```
Localisation: Dashboard Admin > DashboardClient.tsx lignes 48-59
Description: generateMonthlyData() et generateSparklineData() produisent des donnees aleatoires a chaque render
Comportement attendu: Graphiques bases sur des donnees reelles de la base
Severite: CRITIQUE
Solution: Ajouter les donnees mensuelles au RPC admin_stats ou creer un endpoint dedie
```

**Bug #30**
```
Localisation: Dashboard Admin > DashboardClient.tsx lignes 115-160
Description: Tous les trends KPI sont hardcodes (+12%, +5%, +3%) — ne refletent pas la realite
Comportement attendu: Trends calcules dynamiquement (comparaison mois precedent)
Severite: MAJEUR
Solution: Ajouter des donnees de comparaison dans admin_stats (previous_month)
```

**Bug #31**
```
Localisation: Dashboard Admin > DashboardClientV2.tsx
Description: Composant V2 de 27KB avec structure amelioree mais jamais importe nulle part
Comportement attendu: Utiliser V2 ou le supprimer
Severite: MINEUR (code mort)
Solution: Evaluer V2, migrer si superieur, ou supprimer pour eviter la confusion
```

**Bug #32**
```
Localisation: Dashboard Admin > fetchAdminStats.ts ligne 26
Description: recentActivity type any[] — pas de typage strict pour l'activite
Comportement attendu: Interface RecentActivity avec type, description, date
Severite: MINEUR
Solution: Definir une interface typee RecentActivityItem
```

**Bug #33**
```
Localisation: Dashboard Admin > page.tsx
Description: Pas de bouton refresh ni de realtime — donnees figees au chargement server
Comportement attendu: Possibilite de rafraichir les stats sans recharger la page
Severite: MINEUR
Solution: Ajouter React Query avec refetch ou un bouton refresh client-side
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — loading.tsx avec skeleton |
| Animations de transition | Oui — Framer Motion stagger + itemVariants |
| Hierarchie visuelle | Oui — KPIs > Graphiques > Repartitions > Activite > Footer |
| Parcours utilisateur | Basique — pas de liens d'action depuis les KPIs |
| Etats de chargement | Oui — skeleton via loading.tsx, erreur geree dans page.tsx |
| Feedback utilisateur | NON — pas de toasts, pas de refresh |
| Navigation entre sections | NON — pas de liens vers les sections detail (users, properties, etc.) |
| Actions rapides | NON — aucune section d'actions rapides |
| Onboarding jour 1 | NON — pas de guide pour nouvel admin |

**Score UX : 6.5/10**

**Justification :** Belle presentation visuelle avec graphiques riches mais donnees partiellement fictives (-2), pas de refresh (-0.5), pas d'actions rapides (-0.5), pas d'onboarding admin (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-1/2/4 et lg:col-span-8/4 |
| Grille coherente | Oui — grid 12 colonnes pour le layout principal |
| Typographie hierarchisee | Oui — text-3xl titre, text-lg sous-titres |
| Couleurs design system | Oui — variables CSS + hsl pour les charts |
| Icones coherentes | Oui — lucide-react exclusivement |
| Contraste WCAG AA | Oui |
| Espacement regulier | Oui — space-y-8, gap-4/6 |
| Dark mode | Oui — bg-card/50 backdrop-blur-sm |
| Graphiques lisibles | Oui — DonutChart, AreaChartCard, BarChartHorizontal, RadialProgress |
| SOTA 2026 | Oui — backdrop-blur, StatsCardEnhanced avec sparklines, RadialProgress |

**Score UI : 8/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| RPC optimise | Oui — admin_stats() unique |
| Server-side fetch | Oui — fetchAdminStats dans Server Component |
| Cache | NON — force-dynamic, pas de cache |
| Realtime | NON — aucune subscription |
| Lazy loading | NON — tous les composants charts charges immediatement |
| TypeScript | NON — @ts-nocheck desactive tout |

---

## DASHBOARD AGENCE (`/agency/dashboard`)

### Architecture

- **Server Component :** `app/agency/dashboard/page.tsx` (63 lignes) — Suspense + fetch RPC
- **Client Component :** `app/agency/dashboard/AgencyDashboardClient.tsx` (530 lignes) — "use client"
- **Data Fetch :** RPC `agency_dashboard` dans page.tsx (inline)
- **Pas de DataProvider** — donnees passees en props `data`
- **Pas de hook realtime** — aucune subscription

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : KPI Mandats actifs
```
Widget: Compteur mandats actifs / total + gradient card
Source: Supabase — RPC agency_dashboard (stats.mandatsActifs, stats.mandatsTotal)
Filtre applique: oui — p_user_id dans le RPC
RLS respecte: oui — redirect si non authentifie
Etat vide gere: oui — fallback || 0
Bug identifie: aucun
```

#### Widget : KPI Biens geres
```
Widget: Compteur biens geres par mandat
Source: Supabase — RPC agency_dashboard (stats.biensGeres)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — || 0
Bug identifie: aucun
```

#### Widget : KPI Commissions du mois
```
Widget: Commissions encaissees + en attente
Source: Supabase — RPC agency_dashboard (stats.commissionsEncaissees, stats.commissionsEnAttente)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — || 0
Bug identifie: MINEUR — toLocaleString("fr-FR") + "EUR" au lieu de formatCurrency() (ligne 244)
```

#### Widget : KPI Taux d'occupation
```
Widget: Pourcentage biens occupes / geres
Source: Supabase — RPC agency_dashboard (stats.tauxOccupation)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — || 0
Bug identifie: aucun
```

#### Widget : Stats secondaires (Proprietaires, Tickets, Loyers)
```
Widget: 3 cartes avec compteurs
Source: Supabase — RPC agency_dashboard (stats.proprietaires, stats.ticketsOuverts, stats.loyersEncaissesMois)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — || 0
Bug identifie: aucun
```

#### Widget : Mandats recents
```
Widget: Liste des derniers mandats (proprietaire, biens, commission, statut)
Source: Supabase — RPC agency_dashboard (recentMandates)
Filtre applique: oui — par agency
RLS respecte: oui
Etat vide gere: oui — "Aucun mandat recent"
Bug identifie: MINEUR — mandate.owner.charAt(0) crash si owner est vide (ligne 322)
```

#### Widget : Taches en attente
```
Widget: Liste taches prioritaires (EDL, signatures, revisions)
Source: Supabase — RPC agency_dashboard (pendingTasks)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — "Aucune tache en attente"
Bug identifie: MINEUR — bouton "Voir toutes les taches" sans href (ligne 392)
```

#### Widget : Derniers paiements recus
```
Widget: Tableau responsive (mobile cards / desktop table)
Source: Supabase — RPC agency_dashboard (recentPayments)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — "Aucun paiement recent"
Bug identifie: aucun — bonne implementation responsive
```

#### Widget : Performance Card
```
Widget: Banniere gradient avec loyers encaisses, commission, taux occupation, recouvrement, note
Source: DONNEES MIXTES — utilise mockStats (lignes 503-504) au lieu de data.stats
Filtre applique: N/A pour les donnees mock
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: CRITIQUE — mockStats.loyersEncaissesMois et mockStats.commissionsEncaissees hardcodes (52800EUR, 8450EUR)
             Le taux recouvrement "98%" et la note "4.8" sont egalement hardcodes (lignes 514, 519)
```

**Formatage financier :** `toLocaleString("fr-FR")` + concatenation "EUR" — inconsistant avec formatCurrency().

**Formatage dates :** Pas de formatage de dates visible.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #34**
```
Localisation: Dashboard Agence > AgencyDashboardClient.tsx lignes 503-504
Description: Performance Card utilise mockStats (hardcode) au lieu de data.stats pour loyers et commissions
Comportement attendu: Utiliser les donnees reelles du RPC agency_dashboard
Severite: CRITIQUE
Solution: Remplacer mockStats.loyersEncaissesMois par stats.loyersEncaissesMois et mockStats.commissionsEncaissees par stats.commissionsEncaissees
```

**Bug #35**
```
Localisation: Dashboard Agence > AgencyDashboardClient.tsx lignes 514, 519
Description: Taux recouvrement "98%" et note clients "4.8" sont hardcodes dans la Performance Card
Comportement attendu: Donnees calculees depuis les paiements et avis reels
Severite: MAJEUR
Solution: Ajouter ces metriques au RPC agency_dashboard
```

**Bug #36**
```
Localisation: Dashboard Agence > AgencyDashboardClient.tsx lignes 43-130
Description: Variables mockStats, recentMandates, recentPayments, pendingTasks declarees en haut du fichier — code mort eclipse par les props
Comportement attendu: Supprimer le code mort
Severite: MINEUR
Solution: Supprimer les constantes mock inutilisees (sauf dans Performance Card)
```

**Bug #37**
```
Localisation: Dashboard Agence > AgencyDashboardClient.tsx ligne 392
Description: Bouton "Voir toutes les taches" sans href ni onClick — non fonctionnel
Comportement attendu: Lien vers la page des taches agence
Severite: MINEUR
Solution: Ajouter href="/agency/tasks" ou equivalent
```

**Bug #38**
```
Localisation: Dashboard Agence > AgencyDashboardClient.tsx ligne 244
Description: Formatage financier via toLocaleString("fr-FR") + "EUR" au lieu de formatCurrency()
Comportement attendu: Format coherent avec le reste de l'application
Severite: COSMETIQUE
Solution: Importer et utiliser formatCurrency() depuis @/lib/helpers/format
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — Suspense + DashboardSkeleton |
| Animations de transition | Oui — Framer Motion containerVariants + itemVariants |
| Hierarchie visuelle | Oui — KPIs > Stats secondaires > Mandats + Taches > Paiements > Performance |
| Parcours utilisateur | Oui — liens vers mandates, properties, finances |
| Etats de chargement | Partiel — pas de gestion d'erreur visible (data null rend des 0) |
| Feedback utilisateur | NON — pas de toasts, pas de refresh |
| Navigation fluide | Oui — liens directs vers chaque section |
| Actions rapides | Oui — boutons "Nouveau mandat" et "Inviter un proprietaire" |
| Onboarding jour 1 | NON — pas de guide pour nouvelle agence |

**Score UX : 6/10**

**Justification :** Bonne structure avec actions rapides et tableau responsive. Points negatifs : Performance Card avec donnees mock (-2), pas de gestion d'erreur (-0.5), pas de realtime (-0.5), bouton taches non fonctionnel (-0.5), pas d'onboarding (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-1/2/4, tableau mobile/desktop |
| Grille coherente | Oui — grid lg:col-span-2 + col-span-1 |
| Typographie hierarchisee | Oui — text-3xl gradient title |
| Couleurs design system | Oui — gradient cards, bg-card/60 backdrop-blur |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Oui |
| Espacement regulier | Oui — space-y-6, gap-4 |
| Dark mode | Oui — dark: variantes presentes |
| Graphiques lisibles | NON — aucun graphique, seulement des compteurs |
| SOTA 2026 | Partiel — gradient cards oui, mais pas de GlassCard ni de graphiques |

**Score UI : 7.5/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| RPC optimise | Oui — agency_dashboard() unique |
| Server-side fetch | Oui — Suspense dans Server Component |
| Cache | NON — force-dynamic |
| Realtime | NON — aucune subscription |
| Lazy loading | NON — tous les composants charges immediatement |
| TypeScript | Partiel — data: any dans AgencyDashboardClient props |

---

## DASHBOARD SYNDIC (`/syndic/dashboard`)

### Architecture

- **Client Component :** `app/syndic/dashboard/page.tsx` (438 lignes) — "use client" complet (pas de Server Component)
- **Composants inline :** StatCard, QuickAction, AlertItem, DashboardSkeleton, FirstTimeOnboarding (tous dans le meme fichier)
- **Data Fetch :** REST fetch `/api/copro/sites` + `/api/copro/assemblies?upcoming=true` (PAS de RPC dedie)
- **Pas de DataProvider** — state local useState
- **Pas de hook realtime** — aucune subscription

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : KPI Coproprietess
```
Widget: Compteur de coproprietess gerees
Source: Supabase — REST /api/copro/sites (sites.length)
Filtre applique: oui — API filtree par syndic
RLS respecte: oui
Etat vide gere: oui — onboarding si 0 sites
Bug identifie: aucun
```

#### Widget : KPI Lots geres
```
Widget: Nombre de lots total
Source: Calcul client — sites.reduce((sum, s: any) => sum + (s.units?.[0]?.count || 0), 0)
Filtre applique: oui — herite des sites
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: MINEUR — cast (s: any), depend de la structure units[0].count qui est fragile
```

#### Widget : KPI AG a venir
```
Widget: Nombre d'assemblees generales a venir
Source: Supabase — REST /api/copro/assemblies?upcoming=true (assemblies.length)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

#### Widget : KPI Impayes
```
Widget: Nombre d'impayes
Source: DONNEES PLACEHOLDER — stats.unpaid_count toujours 0 (ligne 145)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: CRITIQUE — hardcode a 0 via le TODO ligne 58, donnees jamais fetchees
```

#### Widget : Mes coproprietess (SiteCard)
```
Widget: Grille des 4 premiers sites
Source: Supabase — REST /api/copro/sites
Filtre applique: oui — slice(0, 4)
RLS respecte: oui
Etat vide gere: oui — onboarding complet si 0
Bug identifie: MINEUR — SiteCard rendu avec cast (site as any) ligne 180
```

#### Widget : Actions rapides
```
Widget: 4 boutons (Facture, Appel de fonds, AG, Inviter copro)
Source: Liens statiques (pas de donnees)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: aucun
```

#### Widget : Prochaines AG (AssemblyCard)
```
Widget: Liste des 3 prochaines AG
Source: Supabase — REST /api/copro/assemblies?upcoming=true
Filtre applique: oui — slice(0, 3)
RLS respecte: oui
Etat vide gere: oui — icone Calendar "Aucune AG programmee"
Bug identifie: aucun
```

#### Widget : Alertes
```
Widget: 3 alertes (contrats, impayes, budget)
Source: DONNEES HARDCODEES — 3 AlertItem statiques (lignes 284-296)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: CRITIQUE — "3 contrats arrivent a echeance", "5 lots en impaye depuis 60 jours", "Budget 2025 a valider" sont entierement fictifs
```

#### Widget : Bouton Notifications
```
Widget: Bouton dans le header
Source: N/A
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: MINEUR — bouton Notifications sans onClick ni href (lignes 104-107)
```

**Formatage financier :** Aucun formatage financier visible (les montants ne sont pas affiches).

**Formatage dates :** Aucun formatage de dates visible directement (delegue aux sous-composants SiteCard et AssemblyCard).

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #39**
```
Localisation: Dashboard Syndic > page.tsx lignes 58-66
Description: Stats globales hardcodees a 0 avec commentaire TODO — total_sites, total_units, total_owners, total_balance_due, unpaid_count, upcoming_assemblies tous a 0
Comportement attendu: Stats calculees depuis la base de donnees
Severite: CRITIQUE
Solution: Creer un RPC syndic_dashboard_stats ou appeler l'API existante
```

**Bug #40**
```
Localisation: Dashboard Syndic > page.tsx lignes 284-296
Description: Les 3 alertes sont entierement hardcodees — "3 contrats a echeance", "5 lots en impaye 60j", "Budget 2025 a valider"
Comportement attendu: Alertes dynamiques basees sur les donnees reelles
Severite: CRITIQUE
Solution: Calculer les alertes depuis les baux, paiements et budgets en base
```

**Bug #41**
```
Localisation: Dashboard Syndic > page.tsx ligne 97
Description: (profile as any)?.first_name || (profile as any)?.prenom — double tentative avec cast any
Comportement attendu: Type Profile strict avec champ first_name defini
Severite: MINEUR
Solution: Definir une interface Profile avec les champs attendus
```

**Bug #42**
```
Localisation: Dashboard Syndic > page.tsx lignes 104-107
Description: Bouton Notifications dans le header sans onClick ni href — non fonctionnel
Comportement attendu: Ouvrir les notifications ou lien vers la page notifications
Severite: MINEUR
Solution: Ajouter un handler ou href="/syndic/notifications"
```

**Bug #43**
```
Localisation: Dashboard Syndic > page.tsx ligne 133
Description: Cast (s: any) dans le reduce pour compter les lots — structure units fragile
Comportement attendu: Type Site strict avec units types
Severite: MINEUR
Solution: Typer correctement le Site avec une interface incluant units
```

**Bug #44**
```
Localisation: Dashboard Syndic > page.tsx
Description: Pas de gestion d'erreur — try-catch dans useEffect mais pas de state error affiche
Comportement attendu: Afficher un message d'erreur si les APIs echouent
Severite: MINEUR
Solution: Ajouter un state error et un composant ErrorBanner
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — DashboardSkeleton personnalise |
| Animations de transition | Oui — Framer Motion avec stagger |
| Hierarchie visuelle | Oui — Header > Stats > Sites + Actions > AG + Alertes |
| Parcours utilisateur | Oui — Actions rapides bien placees |
| Etats de chargement | Partiel — skeleton oui, erreur non geree |
| Feedback utilisateur | NON — pas de toasts ni spinner |
| Navigation fluide | Oui — liens vers sites, assemblies, etc. |
| Actions rapides | Oui — 4 boutons avec liens corrects |
| Onboarding jour 1 | Oui — FirstTimeOnboarding si 0 sites |

**Score UX : 5.5/10**

**Justification :** Bonne structure avec onboarding et actions rapides, mais stats toutes a 0 (-2), alertes fictives (-1.5), pas de gestion d'erreur (-0.5), pas de realtime (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-2/4 responsive |
| Grille coherente | Oui — lg:col-span-2 + sidebar |
| Typographie hierarchisee | Oui — text-2xl titre, text-lg sections |
| Couleurs design system | NON — theme dark hardcode (from-slate-900 via-slate-800 to-slate-900) au lieu du design system |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Partiel — text-slate-400 sur fond dark peut etre limite |
| Espacement regulier | Oui — space-y-8, gap-4/6 |
| Dark mode | NON APPLICABLE — force le dark theme, pas de light mode |
| Graphiques lisibles | NON — aucun graphique |
| SOTA 2026 | Partiel — gradients et Glass Cards mais theme isole du design system |

**Score UI : 7/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| RPC dedie | NON — utilise des API REST generiques copro (pas de RPC syndic) |
| Server-side fetch | NON — tout en "use client" avec useEffect |
| Cache | NON — aucun cache |
| Realtime | NON — aucune subscription |
| Lazy loading | NON — 438 lignes dans un seul fichier |
| AbortController | NON — pas de cleanup useEffect |
| Composants extraits | NON — StatCard, QuickAction, AlertItem, etc. tous inline |

---

## DASHBOARD COPROPRIETAIRE (`/copro/dashboard`)

### Architecture

- **Client Component :** `app/copro/dashboard/page.tsx` (450 lignes) — "use client" complet
- **Composants inline :** DashboardSkeleton (dans le meme fichier)
- **Data Fetch :** AUCUN — toutes les donnees sont mockees en dur
- **Pas de DataProvider** — state local useState
- **Pas de hook realtime** — aucune subscription

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : Solde global
```
Widget: Carte avec solde debiteur/crediteur + bouton Payer
Source: MOCK — totalBalance: 125.50 hardcode (ligne 76)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: oui — carte verte "A jour" si 0
Bug identifie: CRITIQUE — donnees 100% fictives, aucun appel API
```

#### Widget : Prochaine AG
```
Widget: Carte prochaine assemblee avec countdown + resolutions
Source: MOCK — AGO 2025, 12 resolutions, date = Date.now() + 15j (lignes 78-84)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: oui — "Aucune AG programmee"
Bug identifie: CRITIQUE — donnees 100% fictives, lien vers /copro/assemblies/ag1 (ID fictif)
```

#### Widget : Documents et Signalements
```
Widget: 2 liens avec compteurs
Source: MOCK — pendingDocuments: 3, openTickets: 1 (lignes 85-86)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: oui — affiche 0
Bug identifie: inclus dans le bug global mock
```

#### Widget : Mes lots
```
Widget: Liste des lots avec solde par lot
Source: MOCK — 1 site "Residence Les Oliviers", 1 lot n°012, tantieme 250, balance 125.50 (lignes 67-75)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A — toujours 1 lot mock
Bug identifie: inclus dans le bug global mock
```

#### Widget : Mes appels de charges
```
Widget: Liste des charges avec statut et bouton download
Source: MOCK — 2 charges (Q4 2024 paye 450EUR, Q1 2025 pending 475EUR) (lignes 87-89)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A — toujours 2 charges mock
Bug identifie: MINEUR — bouton Download sans onClick handler (ligne 383)
```

#### Widget : Espace Bailleur (conditionnel)
```
Widget: Section speciale pour coproprietaires bailleurs
Source: N/A — liens statiques vers /owner/copro/charges et /owner/copro/regularisation
Filtre applique: oui — conditionne par hasRole('coproprietaire_bailleur')
RLS respecte: oui — verification role client-side
Etat vide gere: N/A — masque si non bailleur
Bug identifie: aucun
```

#### Widget : Badge notifications
```
Widget: Badge "2" dans le header
Source: MOCK — valeur "2" hardcodee (ligne 132)
Filtre applique: N/A
RLS respecte: N/A
Etat vide gere: N/A
Bug identifie: MINEUR — nombre notifications hardcode
```

**Formatage financier :** `toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })` inline — non unifie avec formatCurrency().

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #45**
```
Localisation: Dashboard Coproprietaire > page.tsx lignes 62-99
Description: TOUTES les donnees du dashboard sont mockees — aucun appel API, commentaire TODO explicit "Pour l'instant, donnees mockees"
Comportement attendu: Appeler l'API /api/copro/dashboard ou un RPC copro_dashboard
Severite: CRITIQUE
Solution: Creer un endpoint API et remplacer les donnees mock par des donnees reelles
```

**Bug #46**
```
Localisation: Dashboard Coproprietaire > page.tsx ligne 182-185
Description: Bouton "Payer maintenant" sans onClick ni href — non fonctionnel
Comportement attendu: Ouvrir le formulaire de paiement ou lien vers la page de paiement
Severite: MAJEUR
Solution: Ajouter un handler de paiement ou href="/copro/payments"
```

**Bug #47**
```
Localisation: Dashboard Coproprietaire > page.tsx ligne 383
Description: Bouton Download (telechargement appel de charges) sans onClick handler
Comportement attendu: Telecharger le PDF de l'appel de charges
Severite: MINEUR
Solution: Ajouter un handler de telechargement
```

**Bug #48**
```
Localisation: Dashboard Coproprietaire > page.tsx ligne 132
Description: Badge notification hardcode "2" dans le header
Comportement attendu: Nombre dynamique de notifications non lues
Severite: MINEUR
Solution: Fetch le nombre de notifications depuis l'API
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — DashboardSkeleton personnalise |
| Animations de transition | Oui — Framer Motion avec delays |
| Hierarchie visuelle | Oui — Solde > AG > Docs/Tickets > Lots > Charges > Bailleur |
| Parcours utilisateur | Partiel — liens vers sections mais boutons non fonctionnels |
| Etats de chargement | Partiel — loading oui, erreur non geree |
| Feedback utilisateur | NON — pas de toasts, boutons morts |
| Navigation fluide | Oui — liens vers documents, tickets, assemblees |
| Actions rapides | NON — pas de section actions rapides |
| Onboarding jour 1 | NON — pas de guide copro |

**Score UX : 4/10**

**Justification :** Structure et design corrects mais donnees 100% fictives (-4), bouton Payer mort (-1), bouton Download mort (-0.5), badge hardcode (-0.5).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-1/3 responsive |
| Grille coherente | Oui — 3 colonnes pour le header KPIs |
| Typographie hierarchisee | Oui — text-2xl titre, text-3xl montants |
| Couleurs design system | NON — theme dark hardcode (from-slate-900) comme Syndic |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Partiel — text-slate-400 sur fond dark |
| Espacement regulier | Oui — space-y-6, p-6 |
| Dark mode | NON APPLICABLE — force le dark theme |
| Graphiques lisibles | NON — aucun graphique |
| SOTA 2026 | Partiel — gradients conditionnels (rouge/vert) mais pas de GlassCard ni graphiques |

**Score UI : 7/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| API/RPC | NON EXISTANT — pas d'appel serveur |
| Server-side fetch | NON — tout en "use client" |
| Cache | N/A — pas de donnees a cacher |
| Realtime | NON — aucune subscription |
| Lazy loading | NON |
| AbortController | NON |
| Formatage coherent | NON — toLocaleString inline au lieu de formatCurrency |

---

## DASHBOARD GARANT (`/guarantor/dashboard`)

### Architecture

- **Client Component :** `app/guarantor/dashboard/page.tsx` (332 lignes) — "use client"
- **Composant inline :** EngagementCard (lignes 48-114)
- **Service :** `features/profiles/services/guarantor-profiles.service.ts` — getDashboard() via apiClient
- **Pas de DataProvider** — state local useState
- **Pas de hook realtime** — aucune subscription

### AXE 1 — CONNEXION DES DONNEES (Data Binding)

#### Widget : Alertes (signatures et incidents)
```
Widget: Bannieres jaune/rouge conditionnelles
Source: API — /guarantors/dashboard via guarantorProfilesService (stats.pending_signatures, stats.active_incidents)
Filtre applique: oui — par utilisateur authentifie via apiClient
RLS respecte: oui — API filtree par auth
Etat vide gere: oui — bannieres masquees si 0
Bug identifie: aucun
```

#### Widget : KPI Engagements
```
Widget: 4 stats (total engagements, signatures en attente, montant garanti, incidents)
Source: API — /guarantors/dashboard (stats)
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — affiche 0
Bug identifie: aucun
```

#### Widget : Mes engagements (EngagementCard)
```
Widget: Liste des engagements avec statut, locataire, type caution, montant
Source: API — /guarantors/dashboard (engagements[])
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — "Aucun engagement en cours"
Bug identifie: aucun
```

#### Widget : Incidents recents
```
Widget: Liste des incidents avec statut resolu/non resolu
Source: API — /guarantors/dashboard (incidents[])
Filtre applique: oui
RLS respecte: oui
Etat vide gere: oui — "Aucun incident"
Bug identifie: aucun
```

**Formatage financier :** Fonction locale `formatCurrency()` (lignes 33-38) — identique au helper global mais redefinie localement.

**Formatage dates :** Fonction locale `formatDate()` (lignes 40-46) — format "JJ mois AAAA" correct.

---

### AXE 2 — BUGS FONCTIONNELS

**Bug #49**
```
Localisation: Dashboard Garant > page.tsx lignes 33-46
Description: formatCurrency() et formatDate() redefinies localement au lieu d'importer les helpers partages
Comportement attendu: Import depuis @/lib/helpers/format
Severite: COSMETIQUE
Solution: Remplacer les definitions locales par les imports
```

**Bug #50**
```
Localisation: Dashboard Garant > page.tsx
Description: Aucune animation — pas de Framer Motion, pas de PageTransition
Comportement attendu: Animations coherentes avec les autres dashboards
Severite: COSMETIQUE
Solution: Ajouter Framer Motion containerVariants/itemVariants
```

---

### AXE 3 — UX / EXPERIENCE UTILISATEUR

| Critere | Evaluation |
|---|---|
| Chargement fluide | Oui — Skeleton adapte |
| Animations de transition | NON — aucune animation |
| Hierarchie visuelle | Oui — Alertes > Stats > Engagements + Incidents |
| Parcours utilisateur | Oui — bouton signer acte de caution, lien profil |
| Etats de chargement | Oui — loading, error, empty geres |
| Feedback utilisateur | NON — pas de toasts |
| Navigation fluide | Partiel — lien profil mais pas de liens vers les pages detail |
| Actions rapides | Partiel — bouton "Mon profil" dans le header |
| Onboarding jour 1 | NON — pas de guide garant |

**Score UX : 5/10**

**Justification :** Dashboard fonctionnel et propre avec bonnes donnees. Points negatifs : pas d'animations (-1.5), pas de realtime (-1), pas d'onboarding (-1), feedback limité (-0.5), navigation limitee (-1).

---

### AXE 4 — UI / INTERFACE VISUELLE

| Critere | Evaluation |
|---|---|
| Responsive | Oui — grid-cols-1/2/4 responsive |
| Grille coherente | Oui — grille simple |
| Typographie hierarchisee | Oui |
| Couleurs design system | Oui — utilise les composants shadcn (Card, Badge, Alert) |
| Icones coherentes | Oui — lucide-react |
| Contraste WCAG AA | Oui |
| Espacement regulier | Oui |
| Dark mode | Oui — herite du design system shadcn |
| Graphiques lisibles | NON — aucun graphique |
| SOTA 2026 | NON — design basique Cards sans effets visuels modernes |

**Score UI : 6/10**

---

### AXE 5 — PERFORMANCE & TECHNIQUE

| Critere | Evaluation |
|---|---|
| Service pattern | Oui — guarantorProfilesService.getDashboard() propre |
| Server-side fetch | NON — tout en "use client" |
| Cache | NON — aucun cache |
| Realtime | NON — aucune subscription |
| Lazy loading | NON |
| TypeScript | Oui — interfaces bien typees (GuarantorDashboardData, GuarantorDashboardEngagement) |

---

## ROUTEUR GENERIQUE (`/dashboard`)

### Architecture

- **Server Component :** `app/dashboard/page.tsx` (36 lignes) — force-dynamic, redirect
- **Helper :** `lib/helpers/role-redirects.ts` — getRoleDashboardUrl()
- **Auth :** `lib/helpers/auth-helper.ts` — getServerProfile()

### Analyse

```
Fonction: Redirection intelligente vers le dashboard du role
Source: Supabase — getServerProfile() puis getRoleDashboardUrl(profile.role)
Roles geres: admin, platform_admin, owner, tenant, provider, agency, syndic, guarantor,
             coproprietaire, coproprietaire_occupant, coproprietaire_bailleur,
             coproprietaire_nu, usufruitier, president_cs, conseil_syndical
Fallback: "/" si role inconnu, "/auth/signin" si non authentifie
Bug identifie: aucun — implementation propre et complete
```

**Score technique : 9/10** — Code propre, source de verite unique, gestion de tous les roles et sous-roles. Seul point d'amelioration possible : ajouter un skeleton/loader pendant la redirection.

---

## BUGS SUPPLEMENTAIRES TRANSVERSAUX

**Bug #23**
```
Localisation: Dashboard Prestataire > formatDate
Description: Utilise month: "short" (janv., fevr.) quand les autres dashboards utilisent JJ/MM/AAAA
Comportement attendu: Format date coherent sur toute l'application
Severite: COSMETIQUE
Solution: Importer formatDateShort() depuis lib/helpers/format.ts
```

**Bug #24**
```
Localisation: Dashboard Prestataire > formatCurrency
Description: Redefinit formatCurrency() localement au lieu d'importer le helper partage
Comportement attendu: Import depuis @/lib/helpers/format
Severite: COSMETIQUE
Solution: Remplacer la definition locale par l'import
```

**Bug #25**
```
Localisation: Dashboard Proprietaire > API route ligne 107
Description: Utilise gte() sur des dates en format string YYYY-MM pour le filtre 6 mois
Comportement attendu: Comparaison de dates parsees pour eviter les problemes de timezone
Severite: MINEUR
Solution: Parser les dates avant la comparaison
```

**Bug #26**
```
Localisation: Dashboard Proprietaire > use-realtime-dashboard.ts
Description: Le filtre invoices.filter(i => i.statut === "late") ne distingue pas entre "late" reel et "marque late manuellement"
Comportement attendu: Distinction entre retard calcule et retard manuel
Severite: MINEUR
Solution: Ajouter un champ de classification du retard
```

**Bug #27**
```
Localisation: Dashboard Locataire > DashboardClient.tsx > Credit Builder
Description: Le bouton "Exporter mon Passeport Confiance" a un style disabled mais n'est pas reellement disabled en etat charge
Comportement attendu: Soit fonctionnel, soit clairement disabled avec attribut HTML
Severite: COSMETIQUE
Solution: Ajouter disabled={true} avec tooltip "Bientot disponible"
```

---

## PLAN D'ACTION PRIORISE

### 1. Bugs critiques a corriger immediatement (P0)

| # | Bug | Dashboard | Impact |
|---|---|---|---|
| 1 | Bug #45 — Dashboard 100% mocke | Coproprietaire | **Dashboard entierement fictif en production** |
| 2 | Bug #39 — Stats toutes a 0 | Syndic | KPIs mensongers (0 partout) |
| 3 | Bug #40 — Alertes hardcodees | Syndic | Alertes fictives induisant en erreur |
| 4 | Bug #29 — Graphiques Math.random() | Admin | Graphiques de revenus aleatoires |
| 5 | Bug #34 — Performance Card mock | Agence | Metriques fictives (52800EUR, 98%, 4.8) |
| 6 | Bug #01 — recentActivity toujours vide | Proprietaire | Widget non fonctionnel |
| 7 | Bug #10 — Conseil IA hardcode | Locataire | Information trompeuse |
| 8 | Bug #12 — Typo "estate" vs "etat" | Locataire | Banniere securite ne s'affiche jamais |

### 2. Connexions donnees manquantes (P1)

| # | Widget | Dashboard | Action |
|---|---|---|---|
| 1 | **Dashboard entier** | Coproprietaire | Creer RPC copro_dashboard et remplacer toutes les donnees mock |
| 2 | Stats globales | Syndic | Creer RPC syndic_dashboard_stats |
| 3 | Alertes | Syndic | Calculer alertes dynamiques depuis baux, paiements, budgets |
| 4 | Graphiques revenus | Admin | Ajouter monthly_revenue au RPC admin_stats |
| 5 | Trends KPIs | Admin | Ajouter previous_month pour calcul dynamique des trends |
| 6 | Performance Card | Agence | Utiliser data.stats au lieu de mockStats |
| 7 | Activite recente | Proprietaire | Implementer l'aggregation dans l'API |
| 8 | Section Todos | Proprietaire | Aligner props avec zone1_tasks |
| 9 | Conseil IA | Locataire | Rendre dynamique |

### 3. Architecture — Migrer vers Server Components (P2)

| # | Dashboard | Action |
|---|---|---|
| 1 | Syndic | Extraire le fetch dans un Server Component, passer les donnees au client |
| 2 | Coproprietaire | Idem — Server Component + Client Component |
| 3 | Garant | Idem — Server Component avec getDashboard() server-side |
| 4 | Prestataire | Deja en cours (useRealtimeProvider), mais le fetch initial pourrait etre server |

### 4. Ameliorations UX prioritaires (P2)

| # | Amelioration | Dashboard | Impact |
|---|---|---|---|
| 1 | Boutons morts (Payer, Download, Notifications, Contacter) | Copro, Syndic, Locataire, Prestataire | 6 boutons non fonctionnels sur 4 dashboards |
| 2 | Remplacement window.location.reload() | Locataire | UX brisee apres paiement |
| 3 | Ajouter realtime | Admin, Agence, Syndic, Copro, Garant | 5/9 sans mise a jour temps reel |
| 4 | Ajouter DataProvider | Admin, Agence, Syndic, Copro, Garant | 5/9 sans contexte React |
| 5 | Onboarding | Admin, Agence, Copro, Garant, Prestataire | 5/9 sans guide premier jour |
| 6 | Bouton refresh | Admin, Syndic, Copro, Garant | 4/9 sans possibilite de rafraichir |

### 5. Ameliorations UI (P3)

| # | Amelioration | Dashboard | Impact |
|---|---|---|---|
| 1 | Unifier theme (supprimer dark hardcode) | Syndic, Copro | Incoherence visuelle avec le design system |
| 2 | Migrer vers GlassCard + gradients | Prestataire, Garant | Coherence visuelle |
| 3 | Ajouter graphiques (Recharts) | Prestataire, Syndic, Copro, Garant | Visualisations manquantes |
| 4 | Unifier formatCurrency/formatDate | Prestataire, Copro, Garant, Agence | 4 dashboards avec fonctions locales |
| 5 | Supprimer code mort | Admin (V2), Agence (mockStats), Prestataire (VendorDashboard) | 3 fichiers inutilises |

### 6. Optimisations performance (P3)

| # | Optimisation | Dashboard | Impact |
|---|---|---|---|
| 1 | Retirer @ts-nocheck | Admin, Proprietaire, Prestataire | 3 fichiers sans verification TypeScript |
| 2 | Consolider les 6 requetes fetchProfileCompletion | Proprietaire | Gain ~200-400ms |
| 3 | Migrer useEffect → React Query | Prestataire, Syndic, Copro | Cache, retry, staleTime |
| 4 | Ajouter AbortController | Prestataire, Syndic, Copro | Prevention fuites memoire |
| 5 | Lazy loading composants lourds | Locataire, Admin | Charts et composants couteux |
| 6 | Extraire composants inline | Syndic (438 lignes), Copro (450 lignes) | Lisibilite et reutilisation |

---

## COMPARAISON AVEC LE STATE OF THE ART 2026

| Critere | Owner | Tenant | Provider | Admin | Agency | Syndic | Copro | Guarantor | SOTA 2026 |
|---|---|---|---|---|---|---|---|---|---|
| Temps reel | Oui | Oui | Oui | NON | NON | NON | NON | NON | Oui |
| Animations fluides | Oui | Oui | Oui | Oui | Oui | Oui | Oui | NON | Oui |
| Bento Grid | Partiel | Oui | NON | NON | NON | NON | NON | NON | Oui |
| Glass morphism | Oui | Oui | Oui | Oui | Partiel | NON | NON | NON | Oui |
| Graphiques interactifs | Partiel | Oui | NON | Oui* | NON | NON | NON | NON | Oui |
| Onboarding guide | Oui | Oui | NON | NON | NON | Oui | NON | NON | Oui |
| AI-powered insights | Non | Hardcode | Non | Non | Non | Non | Non | Non | Oui |
| Skeleton loaders | Oui | Oui | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| Dark mode | Oui | Oui | Partiel | Oui | Oui | Force | Force | Oui | Oui |
| Server Component | Oui | Oui | NON | Oui | Oui | NON | NON | NON | Oui |
| DataProvider | Oui | Oui | NON | NON | NON | NON | NON | NON | Oui |
| Donnees reelles | ~90% | ~85% | ~80% | ~60% | ~70% | ~30% | **0%** | ~90% | 100% |

*\* Graphiques Admin avec donnees aleatoires (Math.random)*

**Verdict :** Les dashboards Proprietaire et Locataire restent proches du SOTA 2026. Le dashboard Coproprietaire est le plus critique (0% donnees reelles). Syndic et Admin ont des donnees partiellement fictives. Garant a les bonnes donnees mais manque de polish UX/UI. Agency a un bug critique isole (Performance Card mock). 6 dashboards sur 9 n'ont aucun realtime.

---

## SECURITE — RESUME

| Aspect | Owner | Tenant | Provider | Admin | Agency | Syndic | Copro | Guarantor |
|---|---|---|---|---|---|---|---|---|
| Auth serveur | Oui | Oui | Oui | Oui | Oui | Non* | Non* | Non* |
| Verification role | Oui | Oui | Oui | Implicite | Oui | Client | Client | Implicite |
| Filtrage par ID | Oui | Oui | Oui | Oui | Oui | Via API | N/A | Via API |
| RLS Supabase | Oui | Oui | Oui | Oui | Oui | Oui | N/A | Oui |
| Protection 401/403 | Oui | Oui | Oui | Oui | Oui | Oui | N/A | Oui |
| Injection SQL | Non | Non | Non | Non | Non | Non | N/A | Non |
| XSS | Non | Non | Non | Non | Non | Non | Non | Non |

*\* Syndic, Copro et Guarantor sont 100% "use client" — l'authentification est verifiee cote client via useAuth() mais pas server-side dans la page. L'API sous-jacente verifie l'auth, mais le dashboard lui-meme pourrait flasher avant la verification.*

**Risque de securite modere :** Les dashboards "use client" (Syndic, Copro, Guarantor) n'ont pas de verification d'authentification server-side dans le page.tsx. Un utilisateur non authentifie pourrait brievement voir le skeleton avant d'etre redirige. Les donnees restent protegees par les APIs et le RLS, mais la page devrait verifier l'auth cote serveur pour une meilleure protection.

---

## ANNEXE — LISTE COMPLETE DES BUGS

| # | Dashboard | Description | Severite |
|---|---|---|---|
| 01 | Proprietaire | recentActivity toujours vide | CRITIQUE |
| 02 | Proprietaire | Props todos vs zone1_tasks | MAJEUR |
| 03 | Proprietaire | Pas de try-catch page.tsx | MAJEUR |
| 04 | Proprietaire | DPE try-catch vide | MAJEUR |
| 05 | Proprietaire | @ts-nocheck fetchProfileCompletion | MINEUR |
| 06 | Proprietaire | 6 requetes separees | MINEUR |
| 07 | Proprietaire | key={totalRevenue} re-mounts | MINEUR |
| 08 | Proprietaire | Alertes compliance dupliquees | MINEUR |
| 09 | Proprietaire | toLocaleString au lieu de formatCurrency | COSMETIQUE |
| 10 | Locataire | Conseil IA hardcode | CRITIQUE |
| 11 | Locataire | Bouton telephone sans handler | MAJEUR |
| 12 | Locataire | Typo "estate" vs "etat" | MAJEUR |
| 13 | Locataire | window.location.reload() apres paiement | MAJEUR |
| 14 | Locataire | Onboarding step 3 TODO | MINEUR |
| 15 | Locataire | Multi-bail sans UI | MINEUR |
| 16 | Locataire | Chaine "undefined" dans owner.name | MINEUR |
| 17 | Locataire | Multiples cast "as any" | COSMETIQUE |
| 18 | Prestataire | Bouton Contacter sans handler | MAJEUR |
| 19 | Prestataire | VendorDashboardClient code mort | MINEUR |
| 20 | Prestataire | @ts-nocheck VendorDashboard | MINEUR |
| 21 | Prestataire | reviewer null-check manquant | MINEUR |
| 22 | Prestataire | Pas de bouton refresh | MINEUR |
| 23 | Prestataire | Format date inconsistant | COSMETIQUE |
| 24 | Prestataire | formatCurrency locale | COSMETIQUE |
| 25 | Proprietaire | gte() string dates timezone | MINEUR |
| 26 | Proprietaire | Filtre "late" non distingue | MINEUR |
| 27 | Locataire | Bouton export credit disabled | COSMETIQUE |
| 28 | Admin | @ts-nocheck DashboardClient | MAJEUR |
| 29 | Admin | Graphiques Math.random() | CRITIQUE |
| 30 | Admin | Trends KPI hardcodes | MAJEUR |
| 31 | Admin | DashboardClientV2 code mort | MINEUR |
| 32 | Admin | recentActivity type any[] | MINEUR |
| 33 | Admin | Pas de refresh ni realtime | MINEUR |
| 34 | Agence | Performance Card mockStats | CRITIQUE |
| 35 | Agence | Taux recouvrement/note hardcodes | MAJEUR |
| 36 | Agence | Variables mock code mort | MINEUR |
| 37 | Agence | Bouton taches sans href | MINEUR |
| 38 | Agence | formatCurrency locale | COSMETIQUE |
| 39 | Syndic | Stats toutes a 0 (TODO) | CRITIQUE |
| 40 | Syndic | Alertes hardcodees fictives | CRITIQUE |
| 41 | Syndic | profile as any double cast | MINEUR |
| 42 | Syndic | Bouton Notifications sans handler | MINEUR |
| 43 | Syndic | Cast any dans reduce lots | MINEUR |
| 44 | Syndic | Pas de gestion d'erreur | MINEUR |
| 45 | Copro | Dashboard 100% mocke | CRITIQUE |
| 46 | Copro | Bouton Payer sans handler | MAJEUR |
| 47 | Copro | Bouton Download sans handler | MINEUR |
| 48 | Copro | Badge notification hardcode "2" | MINEUR |
| 49 | Garant | formatCurrency/formatDate locales | COSMETIQUE |
| 50 | Garant | Pas d'animations Framer Motion | COSMETIQUE |

### Repartition finale

| Severite | Nombre |
|---|---|
| CRITIQUE | 8 |
| MAJEUR | 14 |
| MINEUR | 20 |
| COSMETIQUE | 8 |
| **TOTAL** | **50** |

---

*Rapport genere le 11/02/2026, mis a jour le 04/03/2026 — Audit complet de 9 dashboards + Generic Router, ~4000 lignes de code analysees*
