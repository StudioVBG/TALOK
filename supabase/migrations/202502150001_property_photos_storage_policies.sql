-- Migration : Policies RLS pour le bucket Storage property-photos
-- Permet aux propriétaires d'uploader/gérer les photos de leurs propriétés

BEGIN;

-- Vérifier que le bucket existe (créé dans 202502141000_property_rooms_photos.sql)
-- Si le bucket n'existe pas, cette migration échouera - créer le bucket d'abord

-- Policy : Les utilisateurs authentifiés peuvent uploader des photos pour leurs propriétés
CREATE POLICY "Owners can upload property photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-photos'
  AND (
    -- Vérifier que le chemin contient un property_id valide
    -- Format attendu : {property_id}/{photo_id}.{ext}
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  )
);

-- Policy : Les utilisateurs peuvent voir les photos des propriétés auxquelles ils ont accès
CREATE POLICY "Users can view accessible property photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (
    -- Propriétaire peut voir ses photos
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND p.owner_id = public.user_profile_id()
    )
    -- Locataire peut voir les photos des propriétés où il a un bail actif
    OR EXISTS (
      SELECT 1 FROM properties p
      JOIN leases l ON l.property_id = p.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND ls.profile_id = public.user_profile_id()
      AND l.statut = 'active'
    )
    -- Admin peut tout voir
    OR public.user_role() = 'admin'
  )
);

-- Policy : Les propriétaires peuvent mettre à jour les photos de leurs propriétés
CREATE POLICY "Owners can update property photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'property-photos'
  AND (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  )
);

-- Policy : Les propriétaires peuvent supprimer les photos de leurs propriétés
CREATE POLICY "Owners can delete property photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id::text = (string_to_array(name, '/'))[1]
      AND p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  )
);

COMMIT;

