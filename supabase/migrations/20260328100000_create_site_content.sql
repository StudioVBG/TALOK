-- ============================================
-- Migration: site_content — CMS léger pour pages marketing
-- Date: 2026-03-28
-- Auteur: Claude
-- ============================================

CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT 'content_body',

  -- Contenu
  content_type TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,

  -- Métadonnées
  title TEXT,
  meta_description TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),

  -- Versioning
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(page_slug, section_key, version)
);

-- RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content_public_read" ON site_content
  FOR SELECT USING (is_published = true);

CREATE POLICY "site_content_admin_all" ON site_content
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- Index pour les requêtes fréquentes
CREATE INDEX idx_site_content_slug ON site_content(page_slug, section_key)
  WHERE is_published = true;

-- Commentaire
COMMENT ON TABLE site_content IS 'CMS léger pour les pages marketing et légales de talok.fr';
