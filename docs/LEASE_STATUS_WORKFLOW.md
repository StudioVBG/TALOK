# Workflow des statuts de bail

Ce document décrit les transitions de statut des baux et les points de décision.

## Statuts possibles

- `draft` — Brouillon (création en cours)
- `sent` — Envoyé au locataire (lien d’invitation envoyé)
- `pending_signature` — En attente de signature
- `partially_signed` — Partiellement signé (au moins un signataire a signé)
- `pending_owner_signature` — Locataires signés, en attente de la signature du propriétaire
- `fully_signed` — Toutes les signatures collectées
- `active` — Bail actif (EDL d’entrée signé, remise des clés effectuée)
- `notice_given` — Préavis donné
- `amended` — Avenant en cours / appliqué
- `terminated` — Résilié / terminé
- `archived` — Archivé
- `cancelled` — Annulé

## Transitions

1. **Création** : `POST /api/leases/invite` → `draft` ou `pending_signature` selon l’envoi d’invitation.
2. **Signatures** : Chaque signature met à jour `lease_signers` ; la logique `determineLeaseStatus()` fixe le statut du bail (`partially_signed`, `pending_owner_signature`, `fully_signed`).
3. **Scellement** : Lorsque le statut passe à `fully_signed`, l’API appelle la RPC `seal_lease` (non bloquant ; en cas d’échec, un événement `Lease.SealRetry` est inséré dans `outbox`).
4. **Activation** : Lorsque l’EDL d’entrée est finalisé (signé par les deux parties), le trigger `check_edl_finalization` met le bail en `active`.
5. **Modification directe du statut** : Bloquée par l’API PATCH ; utiliser les routes dédiées (signer, renouveler, résilier).

## Règles métier

- Dépôt de garantie : plafonds selon le type de bail (voir `getMaxDepotLegal` dans `lib/validations/lease-financial.ts`).
- Bail mobilité : dépôt interdit (Art. 25-13 Loi ELAN).
- DPE G : création de bail bloquée si applicable (loi Climat).
