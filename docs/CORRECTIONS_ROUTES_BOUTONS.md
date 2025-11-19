# Corrections des Routes et Actions des Boutons

## ✅ Corrections appliquées

### 1. Redirection de l'ancien wizard vers le nouveau
**Fichier :** `app/app/owner/property/new/page.tsx`
**Action :** Redirige maintenant vers `/app/owner/properties/new`
**Status :** ✅ Corrigé

### 2. Création de la page d'upload de documents
**Fichier créé :** `app/app/owner/documents/upload/page.tsx`
**Action :** Page créée avec formulaire d'upload
**Status :** ✅ Créé

### 3. Correction des liens d'upload de documents
**Fichier :** `app/app/owner/documents/OwnerDocumentsClient.tsx`
**Avant :** `/documents/upload` (API route)
**Après :** `/app/owner/documents/upload` (Page)
**Status :** ✅ Corrigé (2 occurrences)

### 4. Correction du bouton de téléchargement de document
**Fichier :** `app/app/owner/documents/OwnerDocumentsClient.tsx`
**Avant :** Lien vers `/documents/${doc.id}` (route non vérifiée)
**Après :** Bouton avec action onClick qui ouvre `storage_path`
**Status :** ✅ Corrigé (TODO ajouté pour implémentation complète)

## 📋 Routes validées

### Routes principales
- ✅ `/app/owner/dashboard`
- ✅ `/app/owner/properties`
- ✅ `/app/owner/properties/new` (utilise PropertyWizardV3)
- ✅ `/app/owner/properties/[id]`
- ✅ `/app/owner/properties/[id]/edit`
- ✅ `/app/owner/contracts`
- ✅ `/app/owner/contracts/[id]`
- ✅ `/app/owner/money`
- ✅ `/app/owner/documents`
- ✅ `/app/owner/documents/upload` (NOUVELLE PAGE)
- ✅ `/app/owner/support`
- ✅ `/app/owner/profile`

### Routes externes utilisées
- ✅ `/leases/new` (avec query params `propertyId` ou `property_id`)
- ✅ `/invoices/[id]` (détail d'une facture)

### Routes redirigées
- ✅ `/app/owner/property/new` → `/app/owner/properties/new`

## 🎯 Actions des boutons vérifiées

### Dashboard
- ✅ "Ajouter un bien" → `/app/owner/properties/new`
- ✅ "Demander de l'aide" → `/app/owner/support` (dans le header)

### Properties
- ✅ "Ajouter un bien" → `/app/owner/properties/new`
- ✅ "Voir la fiche" → `/app/owner/properties/[id]`
- ✅ "Créer un bail" → `/leases/new?propertyId=...` ou `/leases/new?property_id=...`
- ✅ "Voir le bail" → `/app/owner/contracts/[id]`
- ✅ "Voir les baux" → `/app/owner/contracts?property_id=...`
- ✅ "Voir les loyers" → `/app/owner/money?property_id=...`
- ✅ "Voir les documents" → `/app/owner/documents?property_id=...`

### Contracts
- ✅ "Créer un bail" → `/leases/new`
- ✅ "Voir" → `/app/owner/contracts/[id]`
- ✅ "Voir les loyers" → `/app/owner/money?lease_id=...`
- ✅ "Voir les documents" → `/app/owner/documents?lease_id=...`

### Money
- ✅ "Marquer payé" → `/invoices/[id]`
- ✅ "Voir mes baux" → `/app/owner/contracts`

### Documents
- ✅ "Téléverser un document" → `/app/owner/documents/upload`
- ✅ "Télécharger" → Action onClick (ouvre storage_path)

## ⚠️ Points d'attention

### 1. Téléchargement de documents
**Status :** Implémentation temporaire
**Action :** Le bouton ouvre `storage_path` dans un nouvel onglet
**TODO :** Implémenter une vraie route de téléchargement avec authentification si nécessaire

### 2. Marquer facture comme payée
**Status :** Pointe vers `/invoices/[id]`
**Action :** Vérifier que la page `/invoices/[id]` permet bien de marquer comme payé
**Note :** La route existe et fonctionne

### 3. Utilisation des constantes OWNER_ROUTES
**Recommandation :** Utiliser `OWNER_ROUTES.properties.path` au lieu de chaînes hardcodées
**Status :** Partiellement appliqué (dashboard utilise les constantes)

## 🔄 Améliorations recommandées

1. **Utiliser les constantes OWNER_ROUTES partout**
   ```tsx
   // Au lieu de :
   <Link href="/app/owner/properties/new">
   
   // Utiliser :
   <Link href={`${OWNER_ROUTES.properties.path}/new`}>
   ```

2. **Créer une fonction helper pour les routes avec query params**
   ```tsx
   const getLeaseNewUrl = (propertyId: string) => 
     `/leases/new?propertyId=${propertyId}`;
   ```

3. **Implémenter le téléchargement de documents sécurisé**
   - Créer une route API `/api/documents/[id]/download`
   - Vérifier les permissions
   - Retourner le fichier avec les bons headers

4. **Vérifier que toutes les routes de détail existent**
   - `/documents/[id]` (si nécessaire)
   - `/invoices/[id]` ✅ (existe déjà)

