-- =====================================================
-- MIGRATION SOTA 2026: Notification propriétaire sur dépôt document locataire
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le trigger trg_notify_tenant_document_center notifie le locataire
--   quand un document lui est ajouté. Mais AUCUNE notification n'existait
--   côté propriétaire quand le locataire dépose un document (assurance,
--   identité, justificatifs, etc.).
--
-- FIX:
--   Trigger AFTER INSERT sur documents qui crée une notification pour
--   le propriétaire lorsque tenant_id ET owner_id sont renseignés.
--
-- SÉCURITÉ:
--   - AFTER INSERT : s'exécute après auto_fill_document_fk (BEFORE)
--   - Exception handler non-bloquant
--   - WHEN clause pour filtrer au niveau trigger (pas de surcoût)
--   - Utilise create_notification() existante
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Notifier le propriétaire
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_owner_on_tenant_document()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name TEXT;
  v_doc_label TEXT;
BEGIN
  -- Récupérer le nom du locataire
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')), ''),
    email,
    'Un locataire'
  )
  INTO v_tenant_name
  FROM public.profiles
  WHERE id = NEW.tenant_id;

  -- Label lisible pour le type de document
  v_doc_label := CASE NEW.type
    WHEN 'attestation_assurance' THEN 'attestation d''assurance'
    WHEN 'cni_recto' THEN 'pièce d''identité (recto)'
    WHEN 'cni_verso' THEN 'pièce d''identité (verso)'
    WHEN 'piece_identite' THEN 'pièce d''identité'
    WHEN 'passeport' THEN 'passeport'
    WHEN 'titre_sejour' THEN 'titre de séjour'
    WHEN 'justificatif_revenus' THEN 'justificatif de revenus'
    WHEN 'avis_imposition' THEN 'avis d''imposition'
    WHEN 'bulletin_paie' THEN 'bulletin de paie'
    WHEN 'rib' THEN 'RIB'
    WHEN 'attestation_loyer' THEN 'attestation de loyer'
    ELSE COALESCE(NEW.type, 'document')
  END;

  -- Utiliser la fonction create_notification existante
  PERFORM create_notification(
    NEW.owner_id,
    'document_uploaded',
    'Nouveau document déposé',
    v_tenant_name || ' a déposé : ' || v_doc_label,
    '/owner/documents',
    NEW.id,
    'document'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_owner_on_tenant_document] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.notify_owner_on_tenant_document() IS
  'SOTA 2026: Notifie le propriétaire quand un locataire dépose un document (assurance, identité, etc.)';

-- ============================================
-- 2. TRIGGER: Exécuter AFTER INSERT quand tenant_id et owner_id sont set
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_owner_on_tenant_document ON public.documents;

CREATE TRIGGER trigger_notify_owner_on_tenant_document
  AFTER INSERT ON public.documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL AND NEW.owner_id IS NOT NULL
        AND NEW.created_by_profile_id IS NOT NULL
        AND NEW.created_by_profile_id = NEW.tenant_id)
  EXECUTE FUNCTION public.notify_owner_on_tenant_document();

COMMIT;
