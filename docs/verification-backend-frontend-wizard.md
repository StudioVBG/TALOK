# Vérification des Connexions Back-End / Front-End - Questionnaire Property V3

## ✅ Statut Global : CONNECTÉ

Toutes les connexions entre le front-end et le back-end sont opérationnelles pour le questionnaire Property V3.

---

## 1. Création de Draft (Étape 1 - Type de bien)

### Front-End
- **Composant** : `PropertyTypeSelection`
- **Service** : `propertiesService.createDraftProperty({ type_bien, usage_principal })`
- **Route API** : `POST /api/properties`

### Back-End
- **Fichier** : `app/api/properties/route.ts`
- **Ligne** : 565-573
- **Validation** : `propertyDraftSchema` (ligne 500-503)
- **Fonction** : `createDraftProperty()` (ligne 431-472)
- **Mapping** : `type_bien` → `type` + `type_bien` (double mapping pour compatibilité)

### BDD
- **Table** : `properties`
- **Colonnes** : `type_bien`, `type`, `owner_id`, `etat` (draft), `unique_code`
- **Migration** : `202502150000_property_model_v3.sql` (ligne 18-37)

### RLS
- ✅ `"Owners can create own properties"` (ligne 44-46 de `20240101000011_fix_properties_rls_recursion.sql`)

---

## 2. Mise à Jour Progressive (Auto-save)

### Front-End
- **Composant** : `PropertyWizardV3`
- **Service** : `propertiesService.updatePropertyGeneral(id, data)`
- **Route API** : `PATCH /api/properties/[id]`
- **Déclenchement** : Auto-save avec debounce (2s) après chaque modification

### Back-End
- **Fichier** : `app/api/properties/[id]/route.ts`
- **Ligne** : 137-345
- **Validation** : `propertyGeneralUpdateSchema` (étendu avec tous les champs V3)
- **Mapping** :
  - `type_bien` → `type` (si `type_bien` fourni mais pas `type`)
  - `loyer_hc` → `loyer_base` (compatibilité)

### Champs V3 Supportés
✅ Tous les champs V3 sont maintenant inclus dans `propertyGeneralUpdateSchema` :
- `type_bien`, `type`
- `complement_adresse`
- `has_balcon`, `has_terrasse`, `has_jardin`, `has_cave`
- `equipments` (TEXT[])
- `chauffage_type`, `chauffage_energie`, `eau_chaude_type`, `clim_presence`, `clim_type`
- `parking_type`, `parking_numero`, `parking_niveau`, `parking_gabarit`, `parking_acces[]`, `parking_portail_securise`, `parking_video_surveillance`, `parking_gardien`
- `local_surface_totale`, `local_type`, `local_has_vitrine`, `local_access_pmr`, `local_clim`, `local_fibre`, `local_alarme`, `local_rideau_metal`, `local_acces_camion`, `local_parking_clients`
- `type_bail`, `preavis_mois`
- `loyer_hc`, `charges_mensuelles`, `depot_garantie`

### BDD
- **Table** : `properties`
- **Colonnes** : Toutes les colonnes V3 définies dans `202502150000_property_model_v3.sql`

### RLS
- ✅ `"Owners can update own properties"` (ligne 49-51 de `20240101000011_fix_properties_rls_recursion.sql`)

---

## 3. Pièces (Rooms)

### Front-End
- **Composant** : `RoomsPhotosStep`
- **Service** : `propertiesService.createRoom(propertyId, payload)`
- **Route API** : `POST /api/properties/[id]/rooms`

### Back-End
- **Fichier** : `app/api/properties/[id]/rooms/route.ts`
- **Ligne** : 77-254
- **Validation** : `roomSchema` (ligne 117)
- **Champs** : `type_piece`, `label_affiche`, `surface_m2`, `chauffage_present`, `clim_presente`, `ordre`

### BDD
- **Table** : `rooms`
- **Colonnes** : `property_id`, `type_piece`, `label_affiche`, `surface_m2`, `chauffage_present`, `clim_presente`, `ordre`
- **Migration** : `202502141000_property_rooms_photos.sql` (ligne 200-262)

### RLS
- ✅ `"Owners can manage rooms"` (ligne 136-144 de `202502141000_property_rooms_photos.sql`)

---

## 4. Photos

### Front-End
- **Composant** : `RoomsPhotosStep`
- **Service** : `propertiesService.requestPhotoUploadUrl(propertyId, payload)`
- **Route API** : `POST /api/properties/[id]/photos/upload-url`

### Back-End
- **Fichier** : `app/api/properties/[id]/photos/upload-url/route.ts`
- **Ligne** : 9-212
- **Validation** : `photoUploadRequestSchema` (ligne 38)
- **Champs** : `file_name`, `mime_type`, `room_id`, `tag`
- **Storage** : Bucket `property-photos` avec URL signée

### BDD
- **Table** : `photos`
- **Colonnes** : `property_id`, `room_id`, `url`, `storage_path`, `tag`, `is_main`, `ordre`
- **Migration** : `202502141000_property_rooms_photos.sql` (ligne 264-290)

### RLS
- ✅ `"Owners can manage photos"` (ligne 175-183 de `202502141000_property_rooms_photos.sql`)
- ✅ Storage policies dans `202502150000_property_photos_storage_policies.sql`

---

## 5. Soumission Finale

### Front-End
- **Composant** : `RecapStep`
- **Service** : `propertiesService.submitProperty(id)`
- **Route API** : `POST /api/properties/[id]/submit`

### Back-End
- **Fichier** : `app/api/properties/[id]/submit/route.ts`
- **Ligne** : 5-408
- **Validation** : Vérification des champs requis selon le type de bien
- **Action** : Met à jour `etat` à `pending_review`

### BDD
- **Table** : `properties`
- **Colonne** : `etat` → `pending_review`
- **Migration** : `202411140210_property_workflow_status.sql`

### RLS
- ✅ `"Owners can update own properties"` (permet la soumission)

---

## 6. Mapping des Champs Front-End → Back-End → BDD

### Étape 1 : Type de bien
| Front-End (formData) | Back-End (validated) | BDD (properties) |
|---------------------|---------------------|-----------------|
| `type_bien` | `type_bien` | `type_bien` |
| `type` (compatibilité) | `type` | `type` |

### Étape 2 : Adresse
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `adresse_complete` | `adresse_complete` | `adresse_complete` |
| `complement_adresse` | `complement_adresse` | `complement_adresse` |
| `code_postal` | `code_postal` | `code_postal` |
| `ville` | `ville` | `ville` |
| `departement` | `departement` | `departement` |

### Étape 3 : Informations essentielles
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `surface_habitable_m2` | `surface_habitable_m2` | `surface_habitable_m2` |
| `nb_pieces` | `nb_pieces` | `nb_pieces` |
| `nb_chambres` | `nb_chambres` | `nb_chambres` |
| `etage` | `etage` | `etage` |
| `ascenseur` | `ascenseur` | `ascenseur` |
| `meuble` | `meuble` | `meuble` |
| `has_balcon` | `has_balcon` | `has_balcon` |
| `has_terrasse` | `has_terrasse` | `has_terrasse` |
| `has_jardin` | `has_jardin` | `has_jardin` |
| `has_cave` | `has_cave` | `has_cave` |
| `chauffage_type` | `chauffage_type` | `chauffage_type` |
| `chauffage_energie` | `chauffage_energie` | `chauffage_energie` |
| `eau_chaude_type` | `eau_chaude_type` | `eau_chaude_type` |
| `clim_presence` | `clim_presence` | `clim_presence` |
| `clim_type` | `clim_type` | `clim_type` |

### Étape 4 : Équipements
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `equipments` (array) | `equipments` (array) | `equipments` (TEXT[]) |

### Étape 5 : Pièces & Photos
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `rooms` (array) | Via `POST /api/properties/[id]/rooms` | Table `rooms` |
| `photos` (array) | Via `POST /api/properties/[id]/photos/upload-url` | Table `photos` |

### Étape 6 : Conditions de location
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `loyer_hc` | `loyer_hc` → `loyer_base` | `loyer_hc`, `loyer_base` |
| `charges_mensuelles` | `charges_mensuelles` | `charges_mensuelles` |
| `depot_garantie` | `depot_garantie` | `depot_garantie` |
| `type_bail` | `type_bail` | `type_bail` |
| `preavis_mois` | `preavis_mois` | `preavis_mois` |

### Parking (si applicable)
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `parking_type` | `parking_type` | `parking_type` |
| `parking_numero` | `parking_numero` | `parking_numero` |
| `parking_niveau` | `parking_niveau` | `parking_niveau` |
| `parking_gabarit` | `parking_gabarit` | `parking_gabarit` |
| `parking_acces` (array) | `parking_acces` (array) | `parking_acces` (TEXT[]) |
| `parking_portail_securise` | `parking_portail_securise` | `parking_portail_securise` |
| `parking_video_surveillance` | `parking_video_surveillance` | `parking_video_surveillance` |
| `parking_gardien` | `parking_gardien` | `parking_gardien` |

### Locaux Pro (si applicable)
| Front-End | Back-End | BDD |
|-----------|----------|-----|
| `local_surface_totale` | `local_surface_totale` | `local_surface_totale` |
| `local_type` | `local_type` | `local_type` |
| `local_has_vitrine` | `local_has_vitrine` | `local_has_vitrine` |
| `local_access_pmr` | `local_access_pmr` | `local_access_pmr` |
| `local_clim` | `local_clim` | `local_clim` |
| `local_fibre` | `local_fibre` | `local_fibre` |
| `local_alarme` | `local_alarme` | `local_alarme` |
| `local_rideau_metal` | `local_rideau_metal` | `local_rideau_metal` |
| `local_acces_camion` | `local_acces_camion` | `local_acces_camion` |
| `local_parking_clients` | `local_parking_clients` | `local_parking_clients` |

---

## 7. Validations

### Front-End
- **Composant** : `PropertyWizardV3`
- **Validation** : `validateProperty()` (ligne 264-280)
- **Schéma** : `propertySchemaV3` (discriminated union selon `type_bien`)

### Back-End
- **Création** : `safeValidatePropertyData()` (détection automatique V3/Legacy)
- **Mise à jour** : `propertyGeneralUpdateSchema` (tous les champs V3 optionnels)
- **Pièces** : `roomSchema`
- **Photos** : `photoUploadRequestSchema`

### BDD
- **Contraintes** : CHECK constraints sur `type`, `etat`, `parking_type`, `local_type`, `type_bail`
- **Migration** : `202502150000_property_model_v3.sql`

---

## 8. Règles RLS (Row Level Security)

### Properties
- ✅ `"Owners can view own properties"` - SELECT
- ✅ `"Owners can create own properties"` - INSERT
- ✅ `"Owners can update own properties"` - UPDATE
- ✅ `"Admins can view all properties"` - SELECT

### Rooms
- ✅ `"Owners can manage rooms"` - ALL (SELECT, INSERT, UPDATE, DELETE)
- ✅ `"Users can view rooms of accessible properties"` - SELECT

### Photos
- ✅ `"Owners can manage photos"` - ALL (SELECT, INSERT, UPDATE, DELETE)
- ✅ `"Users can view photos of accessible properties"` - SELECT

### Storage (property-photos bucket)
- ✅ `"Owners can upload property photos"` - INSERT
- ✅ `"Users can view accessible property photos"` - SELECT
- ✅ `"Owners can update property photos"` - UPDATE
- ✅ `"Owners can delete property photos"` - DELETE

---

## 9. Points d'Attention

### ✅ Résolus
1. ✅ `propertyGeneralUpdateSchema` étendu avec tous les champs V3
2. ✅ Mapping `type_bien` → `type` dans la route PATCH
3. ✅ RLS policies vérifiées et fonctionnelles
4. ✅ Validation automatique V3/Legacy dans POST

### ⚠️ À Surveiller
1. **Compatibilité Legacy** : Le double mapping `type_bien` + `type` est maintenu pour compatibilité
2. **Auto-save** : Les erreurs 404/400 sont ignorées silencieusement (comportement attendu)
3. **Validation partielle** : `propertyGeneralUpdateSchema` permet les mises à jour partielles (tous les champs optionnels)

---

## 10. Tests Recommandés

### Tests E2E
1. ✅ Créer un draft avec `type_bien`
2. ✅ Mettre à jour progressivement tous les champs V3
3. ✅ Ajouter des pièces et photos
4. ✅ Soumettre pour validation

### Tests Unitaires
1. ✅ Validation `propertyGeneralUpdateSchema` avec tous les champs V3
2. ✅ Mapping `type_bien` → `type` dans PATCH
3. ✅ RLS policies pour chaque opération

---

## Conclusion

**Toutes les connexions back-end/front-end sont opérationnelles et validées.**

Le questionnaire Property V3 est entièrement connecté avec :
- ✅ Création de draft
- ✅ Auto-save progressif
- ✅ Gestion des pièces
- ✅ Upload de photos
- ✅ Soumission finale
- ✅ Validation complète
- ✅ RLS policies fonctionnelles

