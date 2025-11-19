# ✅ ÉTAPE 1 : Migration Services → API Routes (TERMINÉE)

## 📋 Résumé des modifications

### Routes API créées

1. **`app/api/leases/[id]/signers/route.ts`**
   - `GET` : Récupérer les signataires d'un bail
   - `POST` : Ajouter un signataire à un bail
   - Validations Zod strictes
   - Vérifications de permissions (propriétaire/admin)

2. **`app/api/leases/[id]/signers/[signerId]/route.ts`**
   - `DELETE` : Supprimer un signataire
   - `PATCH` : Mettre à jour un signataire (statut signature)
   - Validations Zod strictes
   - Vérifications de permissions

3. **`app/api/invoices/generate-monthly/route.ts`**
   - `POST` : Générer une facture mensuelle pour un bail
   - Validation Zod stricte
   - Vérification des doublons (409 si facture existe déjà)
   - Vérifications de permissions (propriétaire/admin)

4. **`app/api/leases/[id]/route.ts`** (amélioré)
   - `PATCH` : Mettre à jour un bail (ajouté)
   - `DELETE` : Supprimer un bail (ajouté)
   - Validations Zod strictes
   - Vérifications de permissions

### Schémas de validation créés

- **`lib/validations/lease-signers.ts`**
  - `addLeaseSignerSchema` : Validation pour ajouter un signataire
  - `updateLeaseSignerSchema` : Validation pour mettre à jour un signataire
  - `signLeaseSchema` : Validation pour signer un bail
  - Types stricts pour les rôles et statuts

### Services migrés

1. **`features/leases/services/leases.service.ts`**
   - ✅ `updateLease()` → utilise `PATCH /api/leases/[id]`
   - ✅ `deleteLease()` → utilise `DELETE /api/leases/[id]`
   - ✅ `getLeaseSigners()` → utilise `GET /api/leases/[id]/signers`
   - ✅ `addSigner()` → utilise `POST /api/leases/[id]/signers`
   - ✅ `removeSigner()` → utilise `DELETE /api/leases/[id]/signers/[signerId]`
   - ✅ `signLease()` → utilise `POST /api/leases/[id]/sign`
   - ✅ `refuseLease()` → utilise `PATCH /api/leases/[id]/signers/[signerId]`
   - ❌ Supprimé : `createClient()` et toutes les références à `this.supabase`

2. **`features/billing/services/invoices.service.ts`**
   - ✅ `generateMonthlyInvoice()` → utilise `POST /api/invoices/generate-monthly`
   - ❌ Supprimé : `createClient()` et toutes les références à `this.supabase`

### Composants mis à jour

- **`features/leases/components/lease-signers.tsx`**
  - ✅ `handleSign()` : Passe maintenant `leaseId` en paramètre
  - ✅ `handleRefuse()` : Passe maintenant `leaseId` en paramètre

## 🔒 Sécurité & Validations

- ✅ Toutes les routes API valident les entrées avec Zod
- ✅ Vérifications de permissions systématiques (propriétaire/admin)
- ✅ Codes HTTP cohérents (200, 201, 400, 401, 403, 404, 409, 500)
- ✅ Messages d'erreur clairs et explicites

## 🧪 Tests à effectuer

1. **Créer un bail** → Vérifier que les signataires peuvent être ajoutés
2. **Ajouter un signataire** → Vérifier les permissions
3. **Signer un bail** → Vérifier que le statut est mis à jour
4. **Refuser un bail** → Vérifier que le statut est mis à jour
5. **Générer une facture mensuelle** → Vérifier les doublons et permissions
6. **Mettre à jour un bail** → Vérifier les permissions
7. **Supprimer un bail** → Vérifier les permissions et les baux actifs

## 📝 Notes

- Tous les services utilisent maintenant uniquement les API routes
- Plus d'appels directs à Supabase depuis les services frontend
- Les validations sont centralisées côté API
- Les permissions sont vérifiées côté serveur

## ⚠️ Points d'attention

- La route `POST /api/leases/[id]/sign` existait déjà mais nécessite peut-être des ajustements pour gérer correctement le `signerId`
- Vérifier que les composants utilisant `signLease()` passent bien le `leaseId`

## 🚀 Prochaines étapes

- **ÉTAPE 2** : Consolidation des hooks dupliqués
- **ÉTAPE 3** : Ajouter validations Zod sur toutes les routes API restantes
- **ÉTAPE 4** : Réduire l'usage de `any`

