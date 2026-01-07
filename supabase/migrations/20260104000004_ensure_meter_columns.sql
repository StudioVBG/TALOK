-- Migration: S'assurer que les colonnes meter_number, serial_number et location existent sur la table meters
-- Date: 2026-01-04

DO $$
BEGIN
    -- 1. Vérifier meter_number (devrait exister)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'meter_number') THEN
        ALTER TABLE public.meters ADD COLUMN meter_number TEXT;
    END IF;

    -- 2. Vérifier serial_number (alias courant)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'serial_number') THEN
        ALTER TABLE public.meters ADD COLUMN serial_number TEXT;
    END IF;

    -- 3. Vérifier location (essentiel pour l'EDL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'location') THEN
        ALTER TABLE public.meters ADD COLUMN location TEXT;
    END IF;

    -- 4. Synchroniser les données existantes entre meter_number et serial_number
    UPDATE public.meters SET serial_number = meter_number WHERE serial_number IS NULL AND meter_number IS NOT NULL;
    UPDATE public.meters SET meter_number = serial_number WHERE meter_number IS NULL AND serial_number IS NOT NULL;

END $$;

