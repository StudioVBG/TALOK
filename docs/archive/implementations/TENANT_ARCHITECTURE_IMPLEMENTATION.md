# Architecture Locataire - État d'implémentation

## ✅ Phase 1 : Modèle de données (COMPLÉTÉ)

### Tables créées

#### 1. Colocation & Split paiements
- ✅ `roommates` - Colocataires avec poids/parts
- ✅ `payment_shares` - Parts de paiement par colocataire
- ✅ `payment_shares_public` - Vue publique (statuts uniquement, montants masqués)

#### 2. Dossier locataire & OCR
- ✅ `tenant_applications` - Dossiers de candidature
- ✅ `application_files` - Fichiers uploadés
- ✅ `extracted_fields` - Champs extraits par OCR/IDP

#### 3. Baux & Signatures avancées
- ✅ `lease_templates` - Modèles de baux
- ✅ `lease_drafts` - Brouillons de baux
- ✅ `signatures` - Signatures avec niveaux (SES/AES/QES)

#### 4. États des lieux
- ✅ `edl` - États des lieux (entrée/sortie)
- ✅ `edl_items` - Items par pièce
- ✅ `edl_media` - Photos/vidéos
- ✅ `edl_signatures` - Signatures EDL

#### 5. Compteurs & énergie
- ✅ `meters` - Compteurs (électricité, gaz, eau)
- ✅ `meter_readings` - Relevés (API, manuel, OCR)
- ✅ `consumption_estimates` - Estimations de consommation

#### 6. Colocation avancée
- ✅ `house_rule_versions` - Versions du règlement
- ✅ `rule_acceptances` - Acceptations par colocataire
- ✅ `chore_schedule` - Planning des tâches
- ✅ `guest_counter` - Compteur d'invités

#### 7. Messagerie & notifications
- ✅ `chat_threads` - Fils de discussion
- ✅ `chat_messages` - Messages
- ✅ `notification_settings` - Paramètres de notifications
- ✅ `notifications` - Notifications (email/push/SMS)

#### 8. Assurance
- ✅ `insurance_policies` - Polices d'assurance
- ✅ `claims` - Sinistres

### RLS Policies (COMPLÉTÉ)
- ✅ Toutes les tables ont des politiques RLS appropriées
- ✅ Masquage des montants des autres colocs dans `payment_shares`
- ✅ Accès basé sur `lease_id` et `user_id`

### Triggers & Fonctions
- ✅ Triggers `updated_at` pour toutes les tables
- ✅ Fonction `update_chat_thread_last_message()`
- ✅ Fonction `validate_payment_shares_total()`

## ✅ Phase 2 : Services TypeScript (COMPLÉTÉ)

### Services créés
- ✅ `roommates.service.ts` - Gestion des colocataires
- ✅ `payment-shares.service.ts` - Split paiements
- ✅ `applications.service.ts` - Dossiers locataire
- ✅ `edl.service.ts` - États des lieux
- ✅ `meters.service.ts` - Compteurs
- ✅ `chat.service.ts` - Messagerie
- ✅ `lease-signatures.service.ts` - Signatures de baux (SES/AES/QES)
- ✅ `colocation.service.ts` - Colocation (règlement, tâches)
- ✅ `notifications.service.ts` - Notifications

## ✅ Phase 3 : Routes API BFF (COMPLÉTÉ)

### Routes créées

#### Auth & Code
- ✅ `POST /api/public/code/verify` - Vérifier un code d'invitation

#### Profil
- ✅ `GET /api/me/profile` - Récupérer le profil
- ✅ `PUT /api/me/profile` - Mettre à jour le profil

#### Dossier & OCR
- ✅ `GET /api/applications` - Liste des applications
- ✅ `POST /api/applications` - Créer une application
- ✅ `POST /api/applications/[id]/files` - Uploader un fichier
- ✅ `POST /api/applications/[id]/analyze` - Déclencher OCR/IDP

#### Baux & Signatures
- ✅ `GET /api/leases/[id]/summary` - Fiche synthèse du bail
- ✅ `POST /api/leases/[id]/sign` - Signer un bail (SES/AES/QES)

#### Paiements & Split
- ✅ `GET /api/leases/[id]/payment-shares` - Récupérer les parts
- ✅ `POST /api/leases/[id]/pay` - Effectuer un paiement
- ✅ `POST /api/leases/[id]/autopay` - Activer/désactiver autopay
- ✅ `GET /api/leases/[id]/receipts` - Récupérer les quittances

#### Colocation
- ✅ `GET /api/leases/[id]/roommates` - Liste des colocataires

#### EDL
- ✅ `POST /api/edl/[id]/sections` - Ajouter des sections/items
- ✅ `POST /api/edl/[id]/sign` - Signer un EDL

#### Compteurs
- ✅ `POST /api/meters/[id]/readings` - Ajouter un relevé
- ✅ `POST /api/meters/[id]/photo-ocr` - Analyser une photo

#### Chat
- ✅ `GET /api/chat/threads/[id]/messages` - Récupérer les messages
- ✅ `POST /api/chat/threads/[id]/messages` - Envoyer un message

#### Notifications
- ✅ `GET /api/notifications` - Liste des notifications
- ✅ `PATCH /api/notifications` - Marquer comme lue
- ✅ `GET /api/notifications/settings` - Paramètres
- ✅ `PATCH /api/notifications/settings` - Mettre à jour paramètres

## ✅ Phase 4 : Composants UI (COMPLÉTÉ)

### Composants créés
- ✅ `payment-card.tsx` - Card de paiement avec statut et CTA
- ✅ `receipts-table.tsx` - Table des quittances
- ✅ `coloc-board.tsx` - Board de colocation (avatars, statuts)
- ✅ `badge.tsx` - Composant Badge (shadcn/ui)
- ✅ `avatar.tsx` - Composant Avatar (shadcn/ui)

### Composants à créer (optionnels)
- ⏳ `application-wizard.tsx` - Wizard de dossier locataire
- ⏳ `lease-viewer.tsx` - Viewer de bail avec synthèse
- ⏳ `tickets-kanban.tsx` - Kanban des tickets
- ⏳ `meters-widget.tsx` - Widget de compteurs
- ⏳ `edl-wizard.tsx` - Wizard d'état des lieux

## ✅ Phase 5 : Routes API restantes (COMPLÉTÉ)

Toutes les routes API essentielles ont été implémentées.

### Routes optionnelles restantes
- ⏳ `GET /api/leases/[id]/documents` - Documents du bail
- ⏳ `GET /api/house-rules/[version]` - Règlement de colocation
- ⏳ `POST /api/house-rules/[version]/sign` - Signer le règlement
- ⏳ `POST /api/chores/rotate` - Rotation des tâches

## ✅ Phase 6 : Services restants (COMPLÉTÉ)

Tous les services essentiels ont été créés.

## ⏳ Phase 7 : Jobs asynchrones

### Edge Functions à créer
- ⏳ `analyze-documents` - OCR/IDP pour documents
- ⏳ `analyze-meter-photo` - OCR pour photos de compteurs
- ⏳ `generate-pdf` - Génération PDF (baux, quittances, EDL)
- ⏳ `recalculate-splits` - Recalcul des splits après paiement
- ⏳ `send-notifications` - Envoi emails/SMS
- ⏳ `sync-enedis-grdf` - Sync relevés automatiques
- ⏳ `webhook-handlers` - Webhooks Stripe, GoCardless, Yousign

## ⏳ Phase 8 : Realtime

### Abonnements Supabase Realtime
- ⏳ Chat messages
- ⏳ Statut paiements (vue publique)
- ⏳ Tickets (mises à jour)
- ⏳ Notifications push

## ✅ Phase 9 : Dashboard Tenant amélioré (COMPLÉTÉ)

- ✅ Dashboard avec widgets avancés
- ✅ PaymentCard intégré
- ✅ ColocBoard intégré
- ✅ ReceiptsTable intégré
- ✅ Chargement automatique du bail actif

## ⏳ Phase 10 : PWA & Offline

### À implémenter
- ⏳ Service Worker
- ⏳ Cache des brouillons (EDL, tickets, pièces)
- ⏳ Reprise d'upload après reconnexion
- ⏳ Mode offline basique

## 📝 Notes importantes

### Sécurité
- ✅ RLS activé sur toutes les tables
- ✅ Masquage des montants des autres colocs
- ✅ Validation des permissions dans les routes API

### Performance
- ✅ Indexes créés sur les colonnes fréquemment utilisées
- ✅ Vue matérialisée `payment_shares_public` pour performance
- ⏳ Pagination à implémenter pour les listes longues

### Intégrations externes
- ⏳ Stripe/GoCardless (paiements) - TODO
- ⏳ Yousign/DocuSign (signatures) - TODO
- ⏳ Google Vision/AWS Textract (OCR) - TODO
- ⏳ Enedis/GRDF (compteurs) - TODO

## 🚀 Prochaines étapes recommandées

1. **Compléter les composants UI essentiels**
   - Receipts table
   - Application wizard
   - Coloc board

2. **Implémenter les routes API manquantes**
   - Signatures de baux
   - EDL complet
   - Chat complet

3. **Créer les Edge Functions**
   - OCR/IDP
   - Génération PDF
   - Notifications

4. **Intégrer les providers externes**
   - Stripe pour paiements
   - Yousign pour signatures
   - Google Vision pour OCR

5. **Ajouter Realtime**
   - Abonnements Supabase
   - Mises à jour en temps réel

6. **PWA & Offline**
   - Service Worker
   - Cache stratégique

