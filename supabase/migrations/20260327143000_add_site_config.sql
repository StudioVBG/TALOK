-- Table de configuration du site vitrine
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  label TEXT,           -- Label lisible pour l'admin
  section TEXT,         -- Groupe dans l'UI admin
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : lecture publique, écriture admin uniquement
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON site_config FOR SELECT USING (true);
CREATE POLICY "Admin write" ON site_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  );

-- Valeurs initiales (images Unsplash par défaut)
INSERT INTO site_config (key, label, section, value) VALUES
  -- Section "Arguments" (4 cartes)
  ('landing_arg_time_img',
   'Argument — Gagnez 3h (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80'),

  ('landing_arg_money_img',
   'Argument — Économisez 2000€ (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'),

  ('landing_arg_contract_img',
   'Argument — Contrats 5 min (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80'),

  ('landing_arg_sleep_img',
   'Argument — Dormez tranquille (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80'),

  -- Section "Profils"
  ('landing_profile_owner_img',
   'Profil — Propriétaire particulier',
   'Profils',
   'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'),

  ('landing_profile_investor_img',
   'Profil — Investisseur / SCI',
   'Profils',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),

  ('landing_profile_agency_img',
   'Profil — Agence / Gestionnaire',
   'Profils',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'),

  -- Section "Avant / Après"
  ('landing_beforeafter_img',
   'Avant/Après — Photo de fond',
   'Avant-Après',
   'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80')

ON CONFLICT (key) DO NOTHING;

-- Bucket public pour les images landing
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique sur le bucket
CREATE POLICY "Public read landing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-images');

-- Politique d'upload admin
CREATE POLICY "Admin upload landing images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);

-- Politique de suppression admin
CREATE POLICY "Admin delete landing images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);
