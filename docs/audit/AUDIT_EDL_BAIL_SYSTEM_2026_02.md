# AUDIT COMPLET — Système EDL & Bail — Talok 2026-02-07

## RÉSUMÉ EXÉCUTIF

L'audit exhaustif du système de création d'états des lieux (EDL) et de documents de bail de Talok révèle une architecture fonctionnelle solide avec **3 bugs critiques bloquants**, **8 problèmes majeurs**, et **14 améliorations recommandées**. Le plus critique : **`signatory_entity_id` est silencieusement supprimé lors de la création du bail**, rendant tout le système multi-entités (SCI/SARL/SAS) inopérant pour les baux. Deux tables de base de données référencent des tables inexistantes (`etats_des_lieux`, `dg_settlements`), et les politiques RLS des tables vétusté/mobilier comparent des types d'UUID incompatibles, bloquant tout accès aux données.

---

## MATRICE DE VÉRIFICATION

| # | Élément | Statut | Criticité | Détail | Action requise |
|---|---------|--------|-----------|--------|----------------|
| 1 | EDL entrée - création | ⚠️ | Haute | Workflow fonctionnel, mais pas de lien entité, 2 endpoints incohérents | Unifier les endpoints, ajouter entity_id |
| 2 | EDL sortie - comparaison | ⚠️ | Haute | Pas de comparaison automatique entrée/sortie implémentée | Implémenter la vue comparative |
| 3 | Signatures EDL | ✅ | — | Fonctionnel via invitation token, preuves crypto OK | — |
| 4 | Compteurs EDL | ✅ | — | 4 types (élec, gaz, eau froide/chaude), photos, DB OK | — |
| 5 | Bail vide - création | ⚠️ | Haute | `signatory_entity_id` silencieusement perdu | FIX CRITIQUE #1 |
| 6 | Bail meublé - création | ⚠️ | Haute | Type supporté mais inventaire mobilier non connecté | FIX #2 (FK cassée) |
| 7 | Bail mobilité | ✅ | — | Dépôt de garantie correctement bloqué à 0 (Art. 25-13 ELAN) | — |
| 8 | Liaison bail ↔ SCI | ❌ | **Critique** | `signatory_entity_id` JAMAIS sauvé en BDD | FIX CRITIQUE #1 |
| 9 | Liaison bail ↔ EDL | ✅ | — | `lease_id` + triggers d'activation automatique OK | — |
| 10 | Stockage documents | ⚠️ | Moyenne | Pas de `edl_id` sur table `documents`, lien indirect via `lease_id` | Ajouter colonne |
| 11 | Conformité DOM-TOM | ⚠️ | Moyenne | Tables diagnostics créées mais pas intégrées dans le wizard | Connecter au wizard |
| 12 | RLS policies | ❌ | **Critique** | Vétusté + mobilier : `owner_id = auth.uid()` compare des UUID incompatibles | FIX CRITIQUE #3 |
| 13 | Génération PDF | ✅ | — | Template HTML conforme décret 2016-382, signatures incluses | — |
| 14 | Responsive / mobile | ✅ | — | Signature tactile, wizard responsive, canvas adaptatif | — |
| 15 | Multi-entités | ❌ | **Critique** | EntitySelector présent mais données non sauvées en BDD | FIX CRITIQUE #1 |
| 16 | FK cassées BDD | ❌ | **Critique** | `furniture_inventories.edl_id → etats_des_lieux` (table inexistante) | FIX CRITIQUE #2 |
| 17 | Vétusté calcul | ❌ | **Critique** | `vetusty_reports.settlement_id → dg_settlements` (table inexistante) | FIX CRITIQUE #2 |
| 18 | 3 systèmes de signature | ⚠️ | Haute | `lease_signers`, `signature_requests`, `signature_sessions` coexistent | Unifier sur `signature_sessions` |
| 19 | Activation double | ⚠️ | Moyenne | Trigger DB + endpoint API activent tous les deux le bail | Supprimer doublon |
| 20 | Rôles incohérents | ⚠️ | Moyenne | Mix français/anglais : `proprietaire`/`owner`/`bailleur` | Normaliser |

---

## FINDINGS DÉTAILLÉS PAR PRIORITÉ

---

### CRITIQUE #1 — `signatory_entity_id` perdu lors de la création du bail

**Fichier:** `app/api/leases/invite/route.ts` (lignes 33-49 et 251-262)

**Problème:** Le `LeaseWizard.tsx` (ligne 542) envoie `signatory_entity_id: selectedEntityId` dans le POST body. Mais le schéma Zod `inviteSchema` ne contient PAS ce champ. Zod supprime silencieusement les champs inconnus lors du `.parse()`. L'objet `leaseData` (ligne 251-262) n'inclut jamais `signatory_entity_id`.

**Impact:**
- Chaque bail créé a `signatory_entity_id = NULL`
- `resolveOwnerIdentity()` ne trouve jamais l'entité via le bail
- Les PDFs de bail montrent les données legacy `owner_profiles` au lieu de la SCI/SARL
- Les PDFs d'EDL montrent le mauvais bailleur
- Le sélecteur d'entité dans le wizard est un composant visuel sans effet

**Fichiers impactés:**
- `app/api/leases/invite/route.ts` — Zod schema + leaseData
- `app/api/leases/[id]/pdf/route.ts` — Fallback systématique
- `app/api/leases/[id]/html/route.ts` — Fallback systématique
- `app/api/edl/preview/route.ts` — Fallback systématique
- `lib/entities/resolveOwnerIdentity.ts` — Chemin lease→entity jamais emprunté

---

### CRITIQUE #2 — Foreign Keys vers des tables inexistantes

**Fichier:** `supabase/migrations/20260127000002_gap002_furniture_inventory.sql`

**Problème 1:** `furniture_inventories.edl_id REFERENCES etats_des_lieux(id)` — La table `etats_des_lieux` n'existe pas. La table EDL s'appelle `edl`. Cette migration ne peut pas s'appliquer.

**Fichier:** `supabase/migrations/20260127000002_vetusty_grid_tables.sql`

**Problème 2:** `vetusty_reports.settlement_id REFERENCES dg_settlements(id)` — La table `dg_settlements` n'existe dans aucune migration.

**Impact:** Ces migrations échouent silencieusement ou bloquent le déploiement. Les fonctionnalités inventaire meublé et calcul de vétusté sont inaccessibles.

**Note:** Il existe DEUX systèmes d'inventaire mobilier en doublon :
- `furniture_inventories` + `furniture_items` (gap002, FK cassée)
- `edl_furniture_inventory` + `edl_mandatory_furniture` + `edl_additional_furniture` (lease_types_and_inventory, FK correcte vers `edl`)

Le système gap002 est cassé et redondant → à supprimer.

---

### CRITIQUE #3 — RLS Policies comparent des UUID incompatibles

**Fichiers:** `20260127000002_vetusty_grid_tables.sql`, `20260127000002_gap002_furniture_inventory.sql`

**Problème:** Toutes les politiques RLS de ces tables utilisent `p.owner_id = auth.uid()` mais :
- `properties.owner_id` → `profiles.id` (UUID profil)
- `auth.uid()` → `auth.users.id` (UUID authentification)

Ces UUID sont différents ! Le pattern correct utilisé partout ailleurs dans Talok est :
```sql
JOIN profiles pr ON pr.id = p.owner_id WHERE pr.user_id = auth.uid()
```

**Impact:** Aucun utilisateur ne peut accéder aux données de vétusté ou d'inventaire mobilier. Les requêtes renvoient toujours un résultat vide.

---

### MAJEUR #4 — Deux endpoints EDL incohérents

**Fichiers:**
- `app/api/leases/[id]/edl/route.ts` — POST crée un EDL mais NE crée PAS les signatures
- `app/api/edl/route.ts` → `lib/services/edl-creation.service.ts` — POST crée un EDL ET injecte les signatures depuis `lease_signers`

**Impact:** Les EDL créés via `/api/leases/[id]/edl` n'ont pas de signature records → le workflow de signature est bloqué.

---

### MAJEUR #5 — Activation de bail en doublon

**Fichiers:**
- `supabase/migrations/20260105000002_edl_lease_sync_triggers.sql` :
  - Trigger `check_edl_finalization()` sur `edl_signatures` → met `edl.status = 'signed'` → met `lease.statut = 'active'`
  - Trigger `trigger_activate_lease_on_edl_signed()` sur `edl.status` UPDATE → re-met `lease.statut = 'active'` + insert `outbox`
- `app/api/leases/[id]/activate/route.ts` — Endpoint manuel qui AUSSI met `statut = 'active'`

**Impact:** Double événement `Lease.Activated` dans la table `outbox`. L'endpoint API ne set pas `entry_edl_id` sur le bail (le trigger le fait).

---

### MAJEUR #6 — Trois systèmes de signature coexistants

| Système | Tables | Statut |
|---------|--------|--------|
| Legacy | `lease_signers`, `edl_signatures` | **EN USAGE** par le code app |
| Intermédiaire | `signature_requests`, `signature_request_signers` | Service existe (`lib/signatures/service.ts`) mais **NON UTILISÉ** |
| Unifié SOTA | `signature_sessions`, `signature_participants`, `signature_proofs`, `signature_audit_log` | Tables créées en DB mais **NON CONNECTÉ** au code app |

**Impact:** Les preuves cryptographiques du système unifié (hashes SHA-256, conformité eIDAS) ne sont pas utilisées par les flux réels de signature.

---

### MAJEUR #7 — Données entité absentes des preuves de signature

**Fichiers:** `app/api/signature/[token]/sign-with-pad/route.ts`, `app/api/signature/edl/[token]/sign/route.ts`

**Problème:** Les preuves de signature (`proof_metadata`) ne contiennent pas les données de l'entité juridique (SCI/SARL). Pour un bail signé au nom d'une SCI, la preuve ne mentionne que la personne physique, pas l'entité.

**Impact:** Insuffisant juridiquement pour les baux d'entités morales.

---

### MAJEUR #8 — EDL pas de comparaison entrée/sortie

**Problème:** Le système ne propose pas de vue comparative automatique entre l'EDL d'entrée et l'EDL de sortie. La table `vetusty_reports` existe avec `edl_entry_id` et `edl_exit_id` mais les RLS sont cassées (Critique #3) et aucun UI ne l'exploite.

---

### MAJEUR #9 — Pas de `entity_id` sur la table EDL

La table `edl` n'a pas de colonne `entity_id` ou `signatory_entity_id`. Contrairement à `leases` et `documents` qui ont des liens vers `legal_entities`, les EDL ne peuvent pas être filtrés par entité.

---

### MAJEUR #10 — Pas de `edl_id` sur la table Documents

Les documents de type `EDL_entree`/`EDL_sortie` sont liés via `lease_id` uniquement. Si un bail a un EDL d'entrée ET de sortie, on ne peut pas distinguer lequel est lequel sans parser le `type` du document.

---

### MAJEUR #11 — EntitySelector ne filtre pas par bien

**Fichier:** `components/entities/EntitySelector.tsx`

Le sélecteur d'entité affiche TOUTES les entités du propriétaire, pas seulement celles qui possèdent le bien sélectionné. Un utilisateur peut associer un bail à une entité qui n'a aucun lien avec le bien.

---

### MINEUR — Autres problèmes identifiés

| # | Problème | Fichier | Sévérité |
|---|---------|---------|----------|
| M1 | `associates_count` toujours 0 | `legal-entities.service.ts:125` | Basse |
| M2 | `netIncome` calcul inversé (+ au lieu de -) | `legal-entities.service.ts:683` | Basse |
| M3 | Token expiration 30j au lieu de 7j documentés | `signature/[token]/sign/route.ts:28` | Basse |
| M4 | `auth.admin.listUsers()` non scalable | `signature/[token]/sign/route.ts:124` | Moyenne |
| M5 | Signer name hardcodé "Locataire" | `EDLSignatureClient.tsx:201` | Basse |
| M6 | `proofId` utilise `Math.random()` pas crypto-safe | `signature-proof.service.ts:83` | Basse |
| M7 | SIREN/SIRET validation longueur seule, pas digits | `legal-entities/route.ts` | Basse |
| M8 | Redirect post-signature EDL suppose authentification | `EDLSignatureClient.tsx` | Basse |
| M9 | `propertyCount`/`activeLeaseCount` toujours 0 dans store | `useEntityStore.ts:97-98` | Basse |
| M10 | Code dupliqué `mapDatabaseToEDLComplet` | `edl/[token]/preview/route.ts` | Basse |
| M11 | Text-mode signature overflow noms longs | `SignaturePad.tsx` | Basse |
| M12 | Missing indexes sur 6 FK columns | Plusieurs tables | Moyenne |
| M13 | Missing ON DELETE rules sur 8 FK columns | Plusieurs tables | Moyenne |
| M14 | `getLegalEntitiesWithStats` ignore param `stats` | `legal-entities/route.ts:69-71` | Basse |

---

## CONNEXIONS DE DONNÉES — CE QUI FONCTIONNE vs CE QUI EST CASSÉ

### ✅ Connexions fonctionnelles

```
properties.owner_id → profiles.id                    ✅ FK + RLS + Index
leases.property_id → properties.id                   ✅ FK CASCADE + Index
edl.lease_id → leases.id                             ✅ FK CASCADE + Index
edl.property_id → properties.id                      ✅ FK SET NULL + Index
edl_items.edl_id → edl.id                            ✅ FK CASCADE + Index
edl_media.edl_id → edl.id                            ✅ FK CASCADE + Index
edl_signatures.edl_id → edl.id                       ✅ FK CASCADE + Index
edl_meter_readings.edl_id → edl.id                   ✅ FK CASCADE + Index
lease_signers.lease_id → leases.id                   ✅ FK CASCADE + Index
documents.lease_id → leases.id                       ✅ FK CASCADE
documents.property_id → properties.id                ✅ FK CASCADE
documents.entity_id → legal_entities.id              ✅ FK SET NULL + Index
properties.legal_entity_id → legal_entities.id       ✅ FK SET NULL + Index
legal_entities.owner_profile_id → owner_profiles     ✅ FK CASCADE + Index
property_ownership.property_id → properties.id       ✅ FK CASCADE + Index
property_ownership.legal_entity_id → legal_entities  ✅ FK CASCADE + Index
```

### ❌ Connexions cassées ou manquantes

```
leases.signatory_entity_id → legal_entities.id       ⚠️ FK existe en DB mais JAMAIS rempli par le code
edl → legal_entities                                  ❌ Pas de colonne entity_id sur edl
documents → edl                                       ❌ Pas de colonne edl_id sur documents
furniture_inventories.edl_id → etats_des_lieux       ❌ TABLE INEXISTANTE
vetusty_reports.settlement_id → dg_settlements       ❌ TABLE INEXISTANTE
vetusty_items.edl_entry_item_id → ???                ❌ Pas de FK déclarée
vetusty_items.edl_exit_item_id → ???                 ❌ Pas de FK déclarée
entity_associates.piece_identite_document_id → ???   ❌ Pas de FK déclarée
entity_associates.justificatif_domicile_document_id  ❌ Pas de FK déclarée
```

---

## AUDIT DES TYPES DE BAIL SUPPORTÉS

| Type | Code DB | Wizard | PDF | Durée | Dépôt | Statut |
|------|---------|--------|-----|-------|-------|--------|
| Vide (habitation) | `nu` | ✅ | ✅ | 36 mois | 1 mois HC | ✅ Fonctionnel |
| Meublé | `meuble` | ✅ | ✅ | 12 mois | 2 mois HC | ⚠️ Inventaire non lié |
| Mobilité | `bail_mobilite` | ✅ | ✅ | 10 mois | 0 (bloqué) | ✅ Fonctionnel |
| Étudiant | `etudiant` | ✅ | ✅ | 9 mois | 1 mois HC | ✅ Fonctionnel |
| Colocation | `colocation` | ✅ | ✅ | 12 mois | 2 mois HC | ✅ Multi-tenant OK |
| Saisonnier | `saisonnier` | ✅ | ✅ | 6 mois | 2 mois HC | ✅ Fonctionnel |
| Commercial 3-6-9 | `commercial_3_6_9` | ✅ | ✅ | 36 mois | Libre | ✅ Fonctionnel |
| Professionnel | `professionnel` | ✅ | ✅ | 72 mois | Libre | ✅ Fonctionnel |
| Parking/Garage | `contrat_parking` | ✅ | ✅ | 12 mois | 2 mois HC | ✅ Fonctionnel |
| Mixte | `bail_mixte` | ✅ | ✅ | 36 mois | 1 mois HC | ✅ Fonctionnel |
| Dérogatoire | `commercial_derogatoire` | ✅ | ✅ | 36 mois | Libre | ✅ Fonctionnel |
| Location-gérance | `location_gerance` | ✅ | ✅ | 24 mois | Libre | ✅ Fonctionnel |
| Rural | `bail_rural` | ✅ | ✅ | 108 mois | 2 mois HC | ✅ Fonctionnel |

---

## AUDIT DES TYPES D'EDL SUPPORTÉS

| Type | Code DB | Wizard | PDF | Statut |
|------|---------|--------|-----|--------|
| Entrée | `entree` | ✅ | ✅ | ✅ Fonctionnel |
| Sortie | `sortie` | ✅ | ✅ | ⚠️ Pas de comparaison auto |
| Intermédiaire | — | ❌ | ❌ | Non implémenté |
| Contradictoire | — | ❌ | ❌ | Non implémenté (par défaut contradictoire) |
| Par huissier | — | ❌ | ❌ | Non implémenté |
| Commercial | `entree`/`sortie` | ⚠️ | ⚠️ | Tables existent, pas intégré au wizard |

---

## AUDIT EDL — WORKFLOW ÉTAPE PAR ÉTAPE

### Étape 1 : Sélection du bail ✅
- Les baux actifs/pending sont listés
- Filtrage par propriétaire OK
- ⚠️ Pas de filtrage par entité juridique

### Étape 2 : Type (entrée/sortie) ✅
- Sélection fonctionnelle
- ⚠️ Pas de type "intermédiaire"

### Étape 3 : Compteurs ✅
- 4 types : électricité (kWh), gaz (m³), eau froide (m³), eau chaude (m³)
- Numéro de compteur + relevé
- Photo de compteur attachable
- ⚠️ Pas de comparaison automatique avec EDL d'entrée en cas de sortie

### Étape 4 : Pièces ✅
- 9 templates : Entrée, Salon, Cuisine, Chambre, SDB, WC, Garage, Cave, Extérieur
- Ajout/suppression/renommage de pièces OK
- Base items par pièce : Sol, Murs, Plafond, Fenêtre(s), Porte, Éclairage, Prises, Chauffage
- 5 états : Neuf, Bon, Moyen, Mauvais, Très mauvais
- Commentaire par élément OK
- Photos par élément OK
- ⚠️ Pas d'inventaire meublé intégré dans ce wizard

### Étape 5 : Inspection (détail) ✅
- Par pièce, évaluation de chaque élément
- Photos uploadables
- Auto-save fonctionnel

### Étape 6 : Clés ✅
- Types par défaut : Porte d'entrée, Badge, Digicode, Boîte aux lettres, Garage, Cave, Télécommande
- Quantité + notes par type
- Ajout de types personnalisés

### Étape 7 : Résumé ✅
- Récapitulatif complet
- Possibilité de revenir en arrière
- Soumission avec création EDL en BDD

### Signatures EDL ✅
- Invitation par token sécurisé (7j d'expiration)
- SignaturePad : mode dessin + mode texte (4 polices cursives)
- Preuve cryptographique SHA-256
- Vérification double signature → `edl.status = 'signed'`
- Activation automatique du bail via trigger

---

## AUDIT BAIL — WORKFLOW ÉTAPE PAR ÉTAPE

### Étape 1 : Type de bail ✅
- 12 types disponibles avec cartes descriptives
- Auto-advance après sélection (600ms)
- Configuration légale par type (durée, dépôt max, charges)

### Étape 2 : Bien + Finances ⚠️
- Sélection du bien avec filtrage par type de bail
- ❌ `EntitySelector` présent mais `signatory_entity_id` JAMAIS sauvé
- Pré-remplissage loyer/charges depuis le bien
- Dépôt de garantie avec max légal automatique
- Bail mobilité : dépôt bloqué à 0
- Type de charges : forfait / provisions
- Date de début → date de fin calculée automatiquement

### Étape 3 : Finalisation (locataire + preview) ✅
- Mode invitation (email) ou mode manuel (brouillon)
- Colocation : multi-tenant avec solidarité, split pondéré
- Garant : personne physique ou morale
- Aperçu live du bail en temps réel (split view)
- ⚠️ Pas de clauses personnalisables
- ⚠️ Pas de gestion des annexes/diagnostics dans le wizard

### Signatures Bail ✅
- Double mode : SignaturePad (recommandé) + OTP SMS/Email (fallback)
- Vérification d'identité optionnelle (CNI scan / France Identité)
- Complétion de profil avant signature
- Preuve cryptographique avec hash document
- ⚠️ Hash du document basé sur JSON snapshot (pas le PDF réel)

---

## CONFORMITÉ LÉGALE 2025-2026

| Exigence | Statut | Détail |
|----------|--------|--------|
| Décret n°2016-382 (modèle EDL) | ✅ | Template conforme, mentions obligatoires présentes |
| Loi ALUR mentions obligatoires bail | ⚠️ | Notice d'information non gérée dans le wizard |
| Loi ELAN bail mobilité | ✅ | Dépôt bloqué, durée max 10 mois |
| Loi Climat - DPE G interdiction 2025 | ⚠️ | DPE affiché mais pas de blocage automatique si G |
| Encadrement des loyers zones tendues | ⚠️ | Table `rent_control` existe mais non connectée au wizard |
| Indexation IRL | ⚠️ | Colonnes en DB mais pas de calcul automatique dans le wizard |
| Durée bail SCI = 6 ans (vs 3 ans) | ❌ | Le wizard utilise la durée du type de bail, pas de vérification entité |
| Signature eIDAS | ✅ | SES (Simple Electronic Signature), preuves SHA-256 |
| RGPD | ✅ | Fonctions `gdpr_export_user_audit_data()` et `gdpr_erase_user_data()` |
| Article 3-2 délai réserve 10j | ⚠️ | Non implémenté dans le système |
| DOM-TOM diagnostics | ⚠️ | Tables créées mais non intégrées au wizard/bail |
| Grille de vétusté | ❌ | Tables créées mais RLS cassées, pas de UI |

---

## PLAN D'ACTION

### P0 — Corrections critiques (à faire immédiatement)

| # | Action | Effort | Fichier(s) |
|---|--------|--------|------------|
| P0-1 | Ajouter `signatory_entity_id` au Zod schema + leaseData | S | `app/api/leases/invite/route.ts` |
| P0-2 | Corriger FK `furniture_inventories.edl_id → edl(id)` | S | Migration SQL |
| P0-3 | Corriger FK `vetusty_reports.settlement_id` | S | Migration SQL |
| P0-4 | Corriger RLS vétusté/mobilier (`profiles.user_id` au lieu de `auth.uid()`) | S | Migration SQL |

### P1 — Corrections majeures (sprint suivant)

| # | Action | Effort | Fichier(s) |
|---|--------|--------|------------|
| P1-1 | Unifier les 2 endpoints de création EDL | M | API routes + service |
| P1-2 | Ajouter `entity_id` sur table `edl` | S | Migration SQL |
| P1-3 | Ajouter `edl_id` sur table `documents` | S | Migration SQL |
| P1-4 | Vérifier durée bail = 6 ans si entité SCI | S | LeaseWizard.tsx |
| P1-5 | Bloquer création bail si DPE = G | M | API route |
| P1-6 | Dédupliquer triggers d'activation lease | S | Migration SQL |
| P1-7 | Ajouter données entité dans preuves de signature | M | sign-with-pad route |
| P1-8 | Filtrer EntitySelector par bien sélectionné | S | EntitySelector.tsx |

### P2 — Améliorations (backlog)

| # | Action | Effort |
|---|--------|--------|
| P2-1 | Implémenter comparaison EDL entrée vs sortie | L |
| P2-2 | Migrer vers le système de signature unifié | XL |
| P2-3 | Ajouter EDL intermédiaire | M |
| P2-4 | Intégrer grille de vétusté dans le wizard | L |
| P2-5 | Intégrer diagnostics DOM-TOM dans le wizard | M |
| P2-6 | Ajouter clauses personnalisables dans le bail | M |
| P2-7 | Ajouter gestion annexes/diagnostics dans le bail wizard | L |
| P2-8 | Connecter encadrement des loyers au wizard | M |
| P2-9 | Auto-save pour le bail wizard (actuellement EDL uniquement) | M |
| P2-10 | Mode hors-ligne pour EDL terrain | XL |
| P2-11 | Normaliser les rôles signataires (français → anglais) | M |
| P2-12 | Ajouter indexes manquants (6 FK columns) | S |
| P2-13 | Ajouter ON DELETE rules manquantes (8 FK columns) | S |
| P2-14 | Supprimer le doublon `furniture_inventories` (gap002) | S |

---

*Audit réalisé le 2026-02-07 — Talok Platform*
*Méthode : analyse statique du code source, des migrations SQL, des types TypeScript, des templates HTML, et des flux de données.*
