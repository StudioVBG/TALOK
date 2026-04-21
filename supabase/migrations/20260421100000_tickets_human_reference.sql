-- =============================================
-- TICKETS : numérotation humaine TKT-YYYY-NNNN
-- =============================================
-- Ajoute une référence lisible (ex. TKT-2026-0042) pour que les utilisateurs
-- puissent citer un ticket par téléphone/email au lieu d'un UUID.
-- La séquence est annuelle et atomique (UPSERT sur ticket_counters).

-- 1. Table de compteurs par année
CREATE TABLE IF NOT EXISTS ticket_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- 2. Colonne reference sur tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_reference ON tickets(reference);

-- 3. Fonction d'incrémentation atomique
CREATE OR REPLACE FUNCTION generate_ticket_reference()
RETURNS TEXT AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_number INTEGER;
BEGIN
  INSERT INTO ticket_counters (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = ticket_counters.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN 'TKT-' || v_year || '-' || LPAD(v_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger BEFORE INSERT : attribue la référence si non fournie
CREATE OR REPLACE FUNCTION set_ticket_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_ticket_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ticket_reference ON tickets;
CREATE TRIGGER trg_set_ticket_reference
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_reference();

-- 5. Backfill : attribue une référence aux tickets existants par ordre
--    chronologique. On reconstruit les compteurs pour rester cohérent.
DO $$
DECLARE
  r RECORD;
  v_year INTEGER;
  v_next INTEGER;
BEGIN
  -- Réinitialise les compteurs si le backfill a déjà tourné partiellement
  TRUNCATE ticket_counters;

  FOR r IN
    SELECT id, created_at
    FROM tickets
    WHERE reference IS NULL OR reference = ''
    ORDER BY created_at ASC, id ASC
  LOOP
    v_year := EXTRACT(YEAR FROM r.created_at)::INTEGER;

    INSERT INTO ticket_counters (year, last_number)
    VALUES (v_year, 1)
    ON CONFLICT (year)
    DO UPDATE SET last_number = ticket_counters.last_number + 1
    RETURNING last_number INTO v_next;

    UPDATE tickets
    SET reference = 'TKT-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

-- 6. Après backfill, les futures insertions reprennent le compteur de l'année
--    en cours (le trigger ré-incrémente depuis last_number courant).

-- 7. NOT NULL après backfill
ALTER TABLE tickets ALTER COLUMN reference SET NOT NULL;
