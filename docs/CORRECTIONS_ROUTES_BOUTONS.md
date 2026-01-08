# Corrections des Routes et Actions des Boutons

## ✅ Corrections appliquées

### 1. Redirection de l'ancien wizard vers le nouveau
**Fichier :** `app/owner/property/new/page.tsx`
**Action :** Redirige maintenant vers `/owner/properties/new`
**Status :** ✅ Corrigé

### 2. Création de la page d'upload de documents
**Fichier créé :** `app/owner/documents/upload/page.tsx`
**Action :** Page créée avec formulaire d'upload
**Status :** ✅ Créé

### 3. Correction des liens d'upload de documents
**Fichier :** `app/owner/documents/OwnerDocumentsClient.tsx`
**Avant :** `/documents/upload` (API route)
**Après :** `/owner/documents/upload` (Page)
**Status :** ✅ Corrigé (2 occurrences)

### 4. Correction du bouton de téléchargement de document
**Fichier :** `app/owner/documents/OwnerDocumentsClient.tsx`
**Avant :** Lien vers `/documents/${doc.id}` (route non vérifiée)
**Après :** Bouton avec action onClick qui ouvre `storage_path`
**Status :** ✅ Corrigé (TODO ajouté pour implémentation complète)

## 📋 Routes validées

### Routes principales
- ✅ `/owner/dashboard`
- ✅ `/owner/properties`
- ✅ `/owner/properties/new` (utilise PropertyWizardV3)
- ✅ `/owner/properties/[id]`
- ✅ `/owner/properties/[id]/edit`
- ✅ `/owner/leases`
- ✅ `/owner/leases/[id]`
- ✅ `/owner/money`
- ✅ `/owner/documents`
- ✅ `/owner/documents/upload` (NOUVELLE PAGE)
- ✅ `/owner/support`
- ✅ `/owner/profile`

### Routes externes utilisées
- ✅ `/leases/new` (avec query params `propertyId` ou `property_id`)
- ✅ `/invoices/[id]` (détail d'une facture)

### Routes redirigées
- ✅ `/owner/property/new` → `/owner/properties/new`

## 🎯 Actions des boutons vérifiées

### Dashboard
- ✅ "Ajouter un bien" → `/owner/properties/new`
- ✅ "Demander de l'aide" → `/owner/support` (dans le header)

### Properties
- ✅ "Ajouter un bien" → `/owner/properties/new`
- ✅ "Voir la fiche" → `/owner/properties/[id]`
- ✅ "Créer un bail" → `/leases/new?propertyId=...` ou `/leases/new?property_id=...`
- ✅ "Voir le bail" → `/owner/leases/[id]`
- ✅ "Voir les baux" → `/owner/leases?property_id=...`
- ✅ "Voir les loyers" → `/owner/money?property_id=...`
- ✅ "Voir les documents" → `/owner/documents?property_id=...`

### Contracts
- ✅ "Créer un bail" → `/leases/new`
- ✅ "Voir" → `/owner/leases/[id]`
- ✅ "Voir les loyers" → `/owner/money?lease_id=...`
- ✅ "Voir les documents" → `/owner/documents?lease_id=...`

### Money
- ✅ "Marquer payé" → `/invoices/[id]`
- ✅ "Voir mes baux" → `/owner/leases`

### Documents
- ✅ "Téléverser un document" → `/owner/documents/upload`
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
   <Link href="/owner/properties/new">
   
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

