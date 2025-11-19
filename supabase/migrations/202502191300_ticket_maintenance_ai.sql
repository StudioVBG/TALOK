-- Migration: Ajout des champs IA pour la maintenance sur les tickets
BEGIN;

-- Add columns to tickets table
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_suggested_action TEXT,
ADD COLUMN IF NOT EXISTS ai_suggested_provider_type TEXT[]; -- Array of strings

COMMIT;

