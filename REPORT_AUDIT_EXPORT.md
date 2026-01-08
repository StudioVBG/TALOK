# Audit des Fonctionnalités d'Exportation - Talok

## 1. Inventaire des points d'exportation

| Endpoint / Fonction | Format | Périmètre | AuthZ | Risque |
| :--- | :--- | :--- | :--- | :--- |
| `/api/accounting/exports` | CSV, XLSX, FEC | Comptabilité globale ou par propriétaire | Rôle Admin/Owner | **CRITICAL** |
| `/api/invoices/[id]/export` | CSV, JSON | Détails d'une facture | Admin/Owner/Tenant | **HIGH** |
| `/api/documents/[id]/download` | PDF, Image | Documents bruts (Baux, Quittances) | Admin/Owner/Tenant | **MEDIUM** |
| `supabase/functions/generate-pdf`| PDF | Baux, EDL, Quittances (Génération) | Service Role | **LOW** |
| `/api/edl/[id]/pdf` | PDF | État des lieux | Admin/Owner/Tenant | **MEDIUM** |

## 2. Analyse détaillée des risques

### 2.1 CSV Injection (Anti-exfiltration)
**Constat** : L'endpoint `/api/accounting/exports` génère du CSV manuellement en concaténant des chaînes. Aucune vérification n'est faite sur le contenu des cellules (ex: `adresse_complete`).
**Risque** : Une cellule commençant par `=`, `+`, `-`, `@` peut exécuter des commandes dans Excel/LibreOffice lors de l'ouverture du fichier par un administrateur.

### 2.2 Sur-export & Minimisation (RGPD)
**Constat** : L'export Single-Invoice (`/api/invoices/[id]/export`) renvoie `*` (tout l'objet invoice) en format JSON.
**Risque** : Exposition potentielle de champs internes, métadonnées techniques ou identifiants de providers tiers non nécessaires à l'utilisateur final.

### 2.3 Absence de ré-authentification
**Constat** : Les exports de masse (comptabilité globale) sont accessibles via une session active standard.
**Risque** : Un attaquant ayant volé une session peut exfiltrer l'intégralité de la base comptable sans barrière supplémentaire (ex: mot de passe ou 2FA).

### 2.4 Audit Trail et Observabilité
**Constat** : Seul `/api/documents/[id]/download` logue l'action dans `audit_log`. Les exports comptables ne sont pas tracés de manière granulaire.
**Risque** : Impossibilité de détecter un "mass-export" suspect ou de prouver qui a accédé à quelles données financières en cas de fuite.

### 2.5 Robustesse et Performance
**Constat** : Les exports sont synchrones (Request/Response).
**Risque** : Sur de gros volumes (ex: des milliers de factures pour un gros propriétaire), le timeout Vercel (10s-30s) ou l'OOM (Out Of Memory) est garanti.

## 3. Recommandations prioritaires

1.  **Standardiser via ExportService** : Centraliser la création de jobs d'export.
2.  **Passer en Asynchrone** : `POST /exports` crée un job, retourne un ID, puis notification/poll pour le lien de téléchargement.
3.  **Sanitization CSV** : Appliquer systématiquement le préfixage `'` pour les contenus suspects.
4.  **Lien Signé avec TTL** : Ne jamais servir le fichier en réponse directe, mais via un lien signé Supabase Storage (expirant en 5-15 min).

