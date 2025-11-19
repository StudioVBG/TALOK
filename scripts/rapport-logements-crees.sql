-- 📊 RAPPORT DÉTAILLÉ DES LOGEMENTS CRÉÉS
-- À exécuter dans Supabase Studio → SQL Editor

-- ============================================================================
-- 1. VUE D'ENSEMBLE
-- ============================================================================

SELECT 
  COUNT(*) as total_logements,
  COUNT(DISTINCT owner_id) as nombre_proprietaires,
  MIN(created_at) as premier_logement,
  MAX(created_at) as dernier_logement
FROM properties;

-- ============================================================================
-- 2. LISTE COMPLÈTE DES LOGEMENTS AVEC TOUS LES DÉTAILS
-- ============================================================================

SELECT 
  p.id,
  p.owner_id,
  pr.prenom || ' ' || pr.nom as proprietaire_nom,
  au.email as proprietaire_email,
  p.type,
  p.adresse_complete,
  p.code_postal,
  p.ville,
  p.departement,
  p.surface,
  p.nb_pieces,
  p.nb_chambres,
  p.etage,
  p.ascenseur,
  p.energie,
  p.ges,
  p.loyer_hc,
  p.encadrement_loyers,
  p.unique_code,
  p.etat,
  p.created_at,
  p.updated_at,
  -- Compter les unités
  (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) as nombre_unites,
  -- Compter les pièces
  (SELECT COUNT(*) FROM rooms r WHERE r.property_id = p.id) as nombre_pieces,
  -- Compter les documents/photos
  (SELECT COUNT(*) FROM documents d WHERE d.property_id = p.id) as nombre_documents,
  -- Compter les baux actifs
  (SELECT COUNT(*) FROM leases l WHERE l.property_id = p.id AND l.statut = 'active') as nombre_baux_actifs
FROM properties p
LEFT JOIN profiles pr ON pr.id = p.owner_id
LEFT JOIN auth.users au ON au.id = pr.user_id
ORDER BY p.created_at DESC;

-- ============================================================================
-- 3. RÉPARTITION PAR TYPE DE BIEN
-- ============================================================================

SELECT 
  type as type_bien,
  COUNT(*) as nombre,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM properties), 2) as pourcentage
FROM properties
GROUP BY type
ORDER BY nombre DESC;

-- ============================================================================
-- 4. RÉPARTITION PAR ÉTAT
-- ============================================================================

SELECT 
  COALESCE(etat, 'non_defini') as etat,
  COUNT(*) as nombre,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM properties), 2) as pourcentage
FROM properties
GROUP BY etat
ORDER BY nombre DESC;

-- ============================================================================
-- 5. RÉPARTITION PAR PROPRIÉTAIRE
-- ============================================================================

SELECT 
  p.owner_id,
  pr.prenom || ' ' || pr.nom as proprietaire_nom,
  pr.email as proprietaire_email,
  COUNT(p.id) as nombre_logements,
  SUM(CASE WHEN p.etat = 'draft' THEN 1 ELSE 0 END) as en_brouillon,
  SUM(CASE WHEN p.etat = 'active' THEN 1 ELSE 0 END) as actifs,
  SUM(CASE WHEN p.etat = 'published' THEN 1 ELSE 0 END) as publies,
  MIN(p.created_at) as premier_logement,
  MAX(p.created_at) as dernier_logement
FROM properties p
LEFT JOIN profiles pr ON pr.id = p.owner_id
LEFT JOIN auth.users au ON au.id = pr.user_id
GROUP BY p.owner_id, pr.prenom, pr.nom, pr.email
ORDER BY nombre_logements DESC;

-- ============================================================================
-- 6. STATISTIQUES FINANCIÈRES
-- ============================================================================

SELECT 
  COUNT(*) as total_logements,
  AVG(loyer_hc) as loyer_moyen,
  MIN(loyer_hc) as loyer_min,
  MAX(loyer_hc) as loyer_max,
  SUM(loyer_hc) as revenus_potentiels_mensuels,
  AVG(surface) as surface_moyenne,
  AVG(nb_pieces) as nb_pieces_moyen
FROM properties
WHERE loyer_hc > 0;

-- ============================================================================
-- 7. LOGEMENTS PAR DÉPARTEMENT
-- ============================================================================

SELECT 
  departement,
  COUNT(*) as nombre_logements,
  AVG(surface) as surface_moyenne,
  AVG(loyer_hc) as loyer_moyen
FROM properties
WHERE departement IS NOT NULL AND departement != '00'
GROUP BY departement
ORDER BY nombre_logements DESC;

-- ============================================================================
-- 8. LOGEMENTS INCOMPLETS (DRAFT OU DONNÉES MANQUANTES)
-- ============================================================================

SELECT 
  p.id,
  p.owner_id,
  p.type,
  p.adresse_complete,
  p.etat,
  CASE 
    WHEN p.adresse_complete = 'Adresse à compléter' THEN 'Adresse manquante'
    WHEN p.surface = 0 OR p.surface IS NULL THEN 'Surface manquante'
    WHEN p.nb_pieces = 0 OR p.nb_pieces IS NULL THEN 'Nb pièces manquant'
    WHEN p.loyer_hc = 0 OR p.loyer_hc IS NULL THEN 'Loyer manquant'
    ELSE 'Autre'
  END as donnee_manquante,
  p.created_at
FROM properties p
WHERE p.etat = 'draft' 
   OR p.adresse_complete = 'Adresse à compléter'
   OR p.surface = 0 
   OR p.nb_pieces = 0
   OR p.loyer_hc = 0
ORDER BY p.created_at DESC;

-- ============================================================================
-- 9. ACTIVITÉ PAR DATE (CRÉATION)
-- ============================================================================

SELECT 
  DATE(created_at) as date_creation,
  COUNT(*) as nombre_logements_crees
FROM properties
GROUP BY DATE(created_at)
ORDER BY date_creation DESC
LIMIT 30;

-- ============================================================================
-- 10. DÉTAILS COMPLETS D'UN LOGEMENT SPÉCIFIQUE (remplacer l'ID)
-- ============================================================================

-- Exemple pour le dernier logement créé
SELECT 
  p.*,
  pr.prenom || ' ' || pr.nom as proprietaire_nom,
  pr.email as proprietaire_email,
  -- Unités
  (SELECT json_agg(json_build_object(
    'id', u.id,
    'nom', u.nom,
    'capacite_max', u.capacite_max,
    'surface', u.surface
  )) FROM units u WHERE u.property_id = p.id) as unites,
  -- Pièces
  (SELECT json_agg(json_build_object(
    'id', r.id,
    'nom', r.nom,
    'type', r.type,
    'surface', r.surface
  )) FROM rooms r WHERE r.property_id = p.id) as pieces,
  -- Photos
  (SELECT json_agg(json_build_object(
    'id', d.id,
    'preview_url', d.preview_url,
    'is_cover', d.is_cover
  )) FROM documents d WHERE d.property_id = p.id AND d.collection = 'property_media' LIMIT 10) as photos,
  -- Baux
  (SELECT json_agg(json_build_object(
    'id', l.id,
    'type_bail', l.type_bail,
    'statut', l.statut,
    'date_debut', l.date_debut,
    'date_fin', l.date_fin
  )) FROM leases l WHERE l.property_id = p.id) as baux
FROM properties p
LEFT JOIN profiles pr ON pr.id = p.owner_id
WHERE p.id = (SELECT id FROM properties ORDER BY created_at DESC LIMIT 1);

