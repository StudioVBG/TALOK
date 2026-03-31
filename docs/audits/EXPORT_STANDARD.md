# Standard d'Exportation de Données (SOTA 2025)

## 1. Classification
- **Access Export** : Un utilisateur télécharge son propre document (ex: sa quittance).
- **Data Portability Export** : Un utilisateur demande l'intégralité de ses données personnelles (RGPD Art. 20).
- **Business/Admin Export** : Un administrateur ou propriétaire exporte des données agrégées pour comptabilité.

## 2. Sécurité & Compliance
- **Anti-CSV Injection** : Toute cellule CSV commençant par `=`, `+`, `-`, `@` doit être préfixée par `'`.
- **Signed URL** : Le téléchargement final se fait via une URL signée Supabase Storage avec un TTL de 15 minutes max.
- **Minimisation** : Utiliser un schéma Zod dédié par type d'export pour filtrer les colonnes (interdiction du `SELECT *`).
- **Audit Trail** : Enregistrement systématique : `user_id`, `export_type`, `filters_used`, `record_count`, `checksum`.
- **Ré-authentification** : Pour tout export dépassant 1000 lignes ou de type "Portabilité", un jeton de ré-authentification récent (< 5 min) est requis.

## 3. Architecture Technique (Async Job)
1. **Initialisation** : `POST /api/exports` -> Vérifie quota + authZ -> Crée record `export_jobs` (status: pending).
2. **Traitement** : Edge Function ou Server Action longue -> Stream les données -> Génère CSV/JSON -> Upload sur Bucket `exports/` (chiffré).
3. **Manifest** : Génération d'un `MANIFEST.json` inclus dans l'archive (ou metadata) avec :
   - `hash_sha256`
   - `generated_at`
   - `user_id`
   - `scope`
4. **Notification** : Mise à jour du job (status: completed) -> Lien de téléchargement disponible.

## 4. Cleanup (TTL)
- Une cron job (`supabase_functions` ou `pg_cron`) supprime les fichiers physiques et les records de jobs vieux de plus de 24 heures.

