# Rapport d'Audit Technique - Workflow État des Lieux (EDL)

**Application:** Talok - Gestion Locative SaaS
**Date:** 2026-01-27
**Auditeur:** Claude (Anthropic)
**Version:** 1.0

---

## Table des Matières

1. [Synthèse Exécutive](#1-synthèse-exécutive)
2. [Architecture Globale](#2-architecture-globale)
3. [Création de l'EDL](#3-création-de-ledl)
4. [Saisie des Pièces et Équipements](#4-saisie-des-pièces-et-équipements)
5. [Flux de Données](#5-flux-de-données)
6. [Génération du Document](#6-génération-du-document)
7. [Signature Électronique](#7-signature-électronique)
8. [Validation Finale](#8-validation-finale)
9. [Relevés de Compteurs](#9-relevés-de-compteurs)
10. [Recommandations](#10-recommandations)

---

## 1. Synthèse Exécutive

### Score Global: 85/100

| Domaine | Score | Statut |
|---------|-------|--------|
| Création EDL | 90% | ✅ Fonctionnel |
| Saisie Pièces/Équipements | 85% | ✅ Fonctionnel |
| Upload Photos | 90% | ✅ Fonctionnel |
| Relevés Compteurs (OCR) | 80% | ✅ Fonctionnel avec fallback |
| Génération Document | 85% | ✅ Fonctionnel (HTML côté client) |
| Signature Électronique | 95% | ✅ Complet avec audit trail |
| Validation & Notifications | 75% | ⚠️ Partiellement implémenté |

### Points Forts
- Architecture SOTA 2026 avec helper centralisé pour les permissions (8 niveaux d'accès)
- Système de signature conforme eIDAS avec dossier de preuve
- OCR automatique pour les relevés de compteurs avec fallback manuel
- Template HTML complet conforme au décret du 30 mars 2016

### Points d'Attention
- Génération PDF côté serveur impossible (limitation Netlify/Puppeteer)
- Intégration Yousign non détectée - signatures internes uniquement
- Notifications via outbox mais pas de consumer visible

---

## 2. Architecture Globale

### 📁 Fichiers Identifiés: 32+

```
TALOK/
├── app/api/edl/
│   ├── [id]/route.ts              # GET/PUT/DELETE EDL
│   ├── [id]/sections/route.ts     # POST sections/items
│   ├── [id]/sign/route.ts         # POST signature
│   ├── [id]/invite/route.ts       # POST invitation locataire
│   ├── [id]/meter-readings/route.ts # GET/POST relevés
│   ├── pdf/route.ts               # POST génération HTML
│   └── preview/route.ts           # POST aperçu
├── app/api/signature/edl/
│   └── [token]/sign/route.ts      # Signature via token
├── app/tenant/inspections/
│   ├── page.tsx                   # Liste EDL
│   └── [id]/page.tsx              # Détail EDL tenant
├── app/signature-edl/
│   └── [token]/EDLSignatureClient.tsx
├── features/
│   ├── tenant/services/edl.service.ts
│   └── end-of-lease/
│       ├── services/edl-meters.service.ts
│       └── components/edl-conductor.tsx
├── lib/
│   ├── helpers/edl-auth.ts        # Permissions centralisées
│   ├── mappers/edl-to-template.ts # Transformation données
│   └── templates/edl/
│       ├── types.ts
│       ├── template.service.ts
│       └── edl.template.ts        # HTML template (35KB)
└── supabase/migrations/
    └── 13 migrations EDL-specific
```

### Schéma Base de Données

```sql
-- Relations principales
lease (1) ──> (n) edl
edl (1) ──> (n) edl_items
edl (1) ──> (n) edl_media
edl (1) ──> (n) edl_signatures
edl (1) ──> (n) edl_meter_readings
property (1) ──> (n) meters
```

### Tables Clés

| Table | Description | Colonnes Clés |
|-------|-------------|---------------|
| `edl` | État des lieux principal | id, lease_id, type (entree/sortie), status, general_notes, keys (JSONB) |
| `edl_items` | Éléments inspectés par pièce | room_name, item_name, condition, notes, category |
| `edl_media` | Photos/vidéos | storage_path, item_id, media_type |
| `edl_signatures` | Signatures avec audit | signer_profile_id, signature_image_path, proof_id, document_hash |
| `edl_meter_readings` | Relevés compteurs | meter_id, reading_value, ocr_confidence, is_validated |

---

## 3. Création de l'EDL

### ✅ Ce qui fonctionne

**Service de création** (`features/tenant/services/edl.service.ts:91-109`)
```typescript
async createEDL(data: CreateEDLData): Promise<EDL> {
  // Authentification vérifiée
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // Insertion avec statut initial 'draft'
  const { data: edl, error } = await this.supabase
    .from("edl")
    .insert({
      ...data,
      created_by: user.id,
      status: "draft",
    })
    .select()
    .single();
}
```

| Champ | Présent | Fonctionnel | Notes |
|-------|---------|-------------|-------|
| `lease_id` | ✅ | ✅ | Lié au bail existant |
| `type` | ✅ | ✅ | "entree" ou "sortie" |
| `scheduled_date` | ✅ | ✅ | Date prévue optionnelle |
| `created_by` | ✅ | ✅ | Auto-rempli avec user.id |
| `status` | ✅ | ✅ | Initial: "draft" |

**Sélection du bien/locataire**
- Les données sont chargées via la relation `lease → property`
- Le locataire est déterminé via `lease_signers` ou `edl_signatures`

**Type d'EDL (entrée/sortie)**
- ✅ La logique distingue bien les deux types
- ✅ Le type affecte l'affichage (couleur, libellés) dans le template

### ⚠️ Points d'attention

1. **Pas de formulaire UI dédié visible** - La création semble se faire via l'interface de fin de bail ou programmatiquement
2. **Validation Zod basique** sur les sections (`app/api/edl/[id]/sections/route.ts:8-22`)

---

## 4. Saisie des Pièces et Équipements

### ✅ Ce qui fonctionne

**Ajout de sections/items** (`app/api/edl/[id]/sections/route.ts:24-132`)

```typescript
// Validation schema Zod
const sectionSchema = z.object({
  sections: z.array(
    z.object({
      room_name: z.string().min(1),
      items: z.array(
        z.object({
          room_name: z.string(),
          item_name: z.string(),
          condition: z.enum(["neuf", "bon", "moyen", "mauvais", "tres_mauvais"]).nullable().optional(),
          notes: z.string().optional().nullable(),
        })
      ),
    })
  ),
});
```

**États supportés** (`lib/templates/edl/types.ts:201-215`):

| Condition | Label | Couleur |
|-----------|-------|---------|
| `neuf` | Neuf | #3b82f6 (bleu) |
| `bon` | Bon état | #22c55e (vert) |
| `moyen` | État moyen | #eab308 (jaune) |
| `mauvais` | Mauvais état | #f97316 (orange) |
| `tres_mauvais` | Très mauvais état | #ef4444 (rouge) |

**Upload de photos** (`features/tenant/services/edl.service.ts:196-226`):
```typescript
async uploadEDLMedia(edlId: string, file: File, itemId?: string): Promise<EDLMedia> {
  const mediaType = file.type.startsWith("video/") ? "video" : "photo";
  const fileName = `edl/${edlId}/${Date.now()}_${file.name}`;

  // Upload vers Supabase Storage (bucket 'documents')
  const { data: uploadData } = await this.supabase.storage
    .from("documents")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  // Enregistrement métadonnées en base
  const { data: media } = await this.supabase
    .from("edl_media")
    .insert({
      edl_id: edlId,
      item_id: itemId,
      storage_path: uploadData.path,
      media_type: mediaType,
    });
}
```

**Interface de capture** (`features/end-of-lease/components/edl-conductor.tsx`):
- ✅ Mode "Plan" - Sélection visuelle des pièces
- ✅ Mode "Capture" - Capture rapide de photos
- ✅ Mode "Organiser" - Drag & drop pour réorganiser
- ✅ Mode "Comparer" - Comparaison entrée/sortie (EDL sortie uniquement)

### ✅ Stockage et Association

- Photos stockées dans le bucket `documents` sous `edl/{edl_id}/`
- Association via `item_id` (nullable pour photos globales de pièce)
- URLs signées générées pour l'affichage (bucket privé)

### ⚠️ Points d'attention

1. **Modification d'items existants** (`app/api/edl/[id]/route.ts:199-240`)
   - Les items avec ID temporaire (`temp_*`) sont créés
   - Les items existants sont mis à jour
   - Pas de suppression atomique visible dans l'API PUT

2. **Mise à jour automatique du statut**
   ```typescript
   // Passage automatique de 'draft' à 'in_progress' après ajout de sections
   await supabase
     .from("edl")
     .update({ status: "in_progress" })
     .eq("id", edlId)
     .eq("status", "draft");
   ```

---

## 5. Flux de Données

### Schéma du Flux

```
[Formulaire UI]
       │
       ▼
[State React] ←──── useSWR / useState
       │
       ▼
[API Route] ────────► Validation Zod
       │
       ▼
[Supabase Client] ── RLS Check
       │
       ▼
[PostgreSQL] ◄────── Triggers (edl_lease_sync)
       │
       ▼
[Outbox] ──────────► Events (Inspection.Signed, EDL.InvitationSent)
       │
       ▼
[Retour UI] ◄─────── JSON Response
```

### Points de Transformation des Données

1. **Entrée (UI → API)**
   - `lib/api-client.ts` - Client HTTP centralisé
   - Validation Zod à l'entrée des routes

2. **Base de données**
   - RLS (Row Level Security) sur toutes les tables EDL
   - Service client (`SUPABASE_SERVICE_ROLE_KEY`) pour bypass RLS quand nécessaire

3. **Sortie (DB → UI)**
   - `lib/mappers/edl-to-template.ts` - Transformation complète vers `EDLComplet`
   - Génération URLs signées pour médias privés

### ✅ Aucune perte de données identifiée

Les transformations sont bien gérées avec:
- Fallbacks multiples pour les champs optionnels
- Logs de debug pour tracer les données manquantes
- Gestion des deux formats (legacy français / anglais BDD)

---

## 6. Génération du Document

### ✅ Ce qui fonctionne

**Template HTML complet** (`lib/templates/edl/edl.template.ts` - 35KB)

Le template inclut:
- ✅ Header avec référence et type d'EDL
- ✅ Informations bailleur et locataire(s)
- ✅ Détails du logement
- ✅ Informations du bail
- ✅ Relevés de compteurs avec icônes
- ✅ Inspection par pièce avec états colorés
- ✅ Photos intégrées (URLs signées)
- ✅ Tableau des clés remises
- ✅ Observations générales
- ✅ Zone de signatures avec images
- ✅ Certificat de preuve (si signé)

**Service de génération** (`lib/templates/edl/template.service.ts:502-505`):
```typescript
export function generateEDLHTML(edl: EDLComplet): string {
  const variables = mapEDLToTemplateVariables(edl);
  return replaceVariables(EDL_TEMPLATE, variables);
}
```

**API de génération** (`app/api/edl/pdf/route.ts`):
- Récupère toutes les données avec admin client (bypass RLS)
- Génère URLs signées pour photos (expiration 1h)
- Retourne HTML formaté avec fallback côté client

### ⚠️ Limitation importante

```typescript
// Note: La génération PDF côté serveur avec Puppeteer n'est pas disponible
// sur Netlify. Le client doit utiliser window.print() ou html2pdf.js
return NextResponse.json({
  html,
  fileName,
  fallback: true,
  message: "Utilisez l'impression du navigateur ou html2pdf.js côté client"
});
```

### ✅ Toutes les données sont incluses

| Donnée | Incluse dans PDF | Source |
|--------|------------------|--------|
| Infos logement | ✅ | `property` |
| Infos bailleur | ✅ | `owner_profiles` |
| Infos locataire(s) | ✅ | `lease_signers` / `edl_signatures` |
| Pièces & items | ✅ | `edl_items` |
| États (bon/mauvais) | ✅ | `edl_items.condition` |
| Notes/commentaires | ✅ | `edl_items.notes` |
| Photos | ✅ | `edl_media` (URLs signées) |
| Compteurs | ✅ | `edl_meter_readings` + `meters` |
| Clés | ✅ | `edl.keys` (JSONB) |
| Observations | ✅ | `edl.general_notes` |
| Signatures | ✅ | `edl_signatures` |
| Certificat preuve | ✅ | `edl_signatures.proof_metadata` |

---

## 7. Signature Électronique

### ✅ Ce qui fonctionne parfaitement

**Système de signature interne avec audit trail complet**

**Route de signature authentifiée** (`app/api/edl/[id]/sign/route.ts`):

```typescript
// 1. Rate limiting pour prévenir les abus
const limiter = getRateLimiterByUser(rateLimitPresets.api);

// 2. Résolution du profil avec 4 stratégies de fallback
// - Par user_id
// - Par email
// - Via edl_signatures
// - Création automatique si nécessaire

// 3. Vérification permissions SOTA (8 niveaux d'accès)
const accessResult = await verifyEDLAccess({
  edlId, userId, profileId, profileRole
}, serviceClient);

// 4. Vérification CNI obligatoire pour locataires
if (!isOwner && !cniNumber) {
  return { error: "Votre identité (CNI) doit être vérifiée avant de signer" };
}

// 5. Upload image signature
const fileName = `edl/${edlId}/signatures/${user.id}_${Date.now()}.png`;
await serviceClient.storage.from("documents").upload(fileName, ...);

// 6. Génération Dossier de Preuve
const proof = await generateSignatureProof({
  documentType: "EDL",
  documentId: edlId,
  documentContent: JSON.stringify(edl),
  signerName: `${profile.prenom} ${profile.nom}`,
  signerEmail: user.email,
  identityVerified: isOwner || !!cniNumber,
  identityMethod: isOwner ? "Compte Propriétaire Authentifié" : `CNI n°${cniNumber}`,
  signatureType: "draw",
  signatureImage: signatureBase64,
  userAgent: request.headers.get("user-agent"),
  ipAddress: extractClientIP(request),
});

// 7. Enregistrement avec preuve cryptographique
await serviceClient.from("edl_signatures").upsert({
  edl_id: edlId,
  signer_user: user.id,
  signer_role: signerRole,
  signed_at: new Date().toISOString(),
  signature_image_path: fileName,
  ip_inet: proof.metadata.ipAddress,
  user_agent: proof.metadata.userAgent,
  proof_id: proof.proofId,
  proof_metadata: proof,
  document_hash: proof.document.hash,
});
```

**Système d'invitation par token** (`app/api/edl/[id]/invite/route.ts`):
- Génère un token UUID unique
- Stocké dans `edl_signatures.invitation_token`
- Email envoyé via outbox (`EDL.InvitationSent`)

**Signature via token** (`app/api/signature/edl/[token]/sign/route.ts`):
- Validation du token
- Vérification non-déjà-signé
- Même processus de preuve que la signature authentifiée

### ✅ Dossier de Preuve (Audit Trail)

Le `proof_metadata` contient:
- `proofId` - UUID unique de la preuve
- `document.hash` - Hash SHA-256 du contenu
- `signer.name`, `email`, `identityMethod`
- `metadata.ipAddress`, `userAgent`, `timestamp`
- `signatureImage` - Base64 de la signature

### ⚠️ Intégration Yousign

**Non détectée dans le code analysé.**

Le système utilise une signature électronique interne conforme eIDAS niveau simple. Pour une conformité eIDAS avancée/qualifiée, une intégration Yousign serait nécessaire mais n'est pas implémentée actuellement.

---

## 8. Validation Finale

### ✅ Mise à jour automatique du statut

```typescript
// Vérification si tous les signataires ont signé
const hasOwner = allSignatures?.some(
  (s) => (s.signer_role === "owner" || s.signer_role === "proprietaire")
    && s.signature_image_path && s.signed_at
);
const hasTenant = allSignatures?.some(
  (s) => (s.signer_role === "tenant" || s.signer_role === "locataire")
    && s.signature_image_path && s.signed_at
);

if (hasOwner && hasTenant) {
  // Passage au statut 'signed'
  await serviceClient.from("edl").update({ status: "signed" }).eq("id", edlId);

  // Émission événement
  await serviceClient.from("outbox").insert({
    event_type: "Inspection.Signed",
    payload: { edl_id: edlId, all_signed: true },
  });
}
```

### ✅ Document signé stocké

- Images de signature: `documents/edl/{edl_id}/signatures/`
- Métadonnées: `edl_signatures` table
- Preuve: `proof_metadata` JSONB

### ⚠️ Notifications

**Implémentation via outbox pattern:**
```typescript
await serviceClient.from("outbox").insert({
  event_type: "Inspection.Signed",
  payload: { edl_id: edlId, all_signed: true },
});
```

**Événements identifiés:**
- `Inspection.Signed` - EDL complètement signé
- `EDL.InvitationSent` - Invitation envoyée au locataire

**Point d'attention:** Le consumer de l'outbox (worker qui envoie les emails) n'a pas été analysé dans ce périmètre.

---

## 9. Relevés de Compteurs

### ✅ Ce qui fonctionne

**API complète avec OCR** (`app/api/edl/[id]/meter-readings/route.ts`):

```typescript
// Support multipart/form-data ET JSON
if (contentType.includes("multipart/form-data")) {
  const formData = await request.formData();
  meterId = formData.get("meter_id");
  photo = formData.get("photo");
  manualValue = formData.get("manual_value");
  // ...
} else {
  const body = await request.json();
  // ...
}

// OCR automatique si photo fournie
if (photo) {
  const ocrResponse = await meterOCRService.analyzeMeterPhoto(
    photoBuffer,
    actualMeterData.type as MeterType
  );
  ocrResult = {
    value: ocrResponse.value,
    confidence: ocrResponse.confidence,
    needsValidation: ocrResponse.needsValidation,
  };
}

// Validation automatique si confiance >= 80%
isValidated = ocrResult.confidence >= 80;
needsManualValidation = !isValidated;
```

**Types de compteurs supportés** (`lib/types/edl-meters.ts`):

| Type | Label | Icône | Unité par défaut |
|------|-------|-------|------------------|
| `electricity` | Électricité | ⚡ | kWh |
| `gas` | Gaz | 🔥 | m³ |
| `water` | Eau froide | 💧 | m³ |
| `water_hot` | Eau chaude | 🚿 | m³ |

**Création automatique de compteur** si non existant:
```typescript
if (!existingMeter) {
  const { data: newMeter } = await serviceClient
    .from("meters")
    .insert({
      property_id: edlPropertyId,
      type: meterType,
      meter_number: meterNumber || `SN-${Date.now()}`,
      unit: readingUnit,
    });
}
```

### ✅ Gestion robuste des valeurs

```typescript
// Gérer les valeurs null/undefined: afficher "À valider" si photo mais pas de valeur
let readingValue: string;
if (hasNumericValue) {
  readingValue = String(m.reading_value);
} else if (hasStringValue) {
  readingValue = m.reading!;
} else if (hasPhoto) {
  readingValue = "À valider"; // Photo présente mais pas de valeur OCR
} else {
  readingValue = "Non relevé";
}
```

### ⚠️ Point d'attention

L'OCR utilise Tesseract en fallback. Pour une meilleure précision, Google Vision ou Mindee sont configurables mais nécessitent des API keys.

---

## 10. Recommandations

### Priorité Haute 🔴

1. **Implémenter un consumer pour l'outbox**
   - Les événements `Inspection.Signed` et `EDL.InvitationSent` sont émis
   - Mais aucun worker/consumer visible pour envoyer les emails

2. **Ajouter une interface de création d'EDL**
   - Actuellement pas de formulaire UI dédié visible
   - Recommandation: Page `/dashboard/edl/new` avec wizard

3. **Génération PDF serveur**
   - Migrer vers un service externe (ex: Gotenberg, PDFShift)
   - Ou utiliser Vercel Edge Functions avec @vercel/og

### Priorité Moyenne 🟡

4. **Intégration Yousign** (si conformité eIDAS avancée requise)
   - Le système actuel est niveau simple
   - Pour les EDL importants, une signature qualifiée peut être nécessaire

5. **Améliorer l'OCR des compteurs**
   - Configurer Google Vision ou Mindee pour meilleure précision
   - Ajouter un mode "correction manuelle" plus visible dans l'UI

6. **Tests E2E du workflow complet**
   - Un test `edl-audit-test.ts` est référencé mais non analysé
   - Recommandation: Couverture complète du parcours

### Priorité Basse 🟢

7. **Optimisation des requêtes**
   - Certaines routes font plusieurs requêtes séquentielles
   - Possibilité de consolider avec des jointures

8. **Mode hors-ligne pour mobile**
   - Le composant `SmartPhotoCapture` pourrait supporter le mode offline
   - Synchronisation différée des photos

---

## Conclusion

Le workflow EDL de Talok est **fonctionnel et bien architecturé** avec une implémentation SOTA 2026. Les points forts incluent:

- **Sécurité**: Helper centralisé avec 8 niveaux de permissions
- **Conformité**: Template conforme au décret du 30 mars 2016
- **Audit**: Dossier de preuve complet avec hash cryptographique
- **Robustesse**: Multiples fallbacks pour la résolution des données

Les principaux axes d'amélioration concernent:
- L'envoi effectif des notifications (consumer outbox)
- La génération PDF côté serveur
- L'intégration d'un service de signature qualifiée (Yousign)

---

## Annexe: Fichiers Analysés

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `lib/helpers/edl-auth.ts` | 276 | Permissions centralisées |
| `lib/templates/edl/template.service.ts` | 627 | Génération HTML |
| `lib/templates/edl/edl.template.ts` | ~800 | Template HTML |
| `lib/mappers/edl-to-template.ts` | 492 | Transformation données |
| `app/api/edl/[id]/route.ts` | 335 | CRUD EDL |
| `app/api/edl/[id]/sign/route.ts` | 426 | Signature authentifiée |
| `app/api/edl/[id]/meter-readings/route.ts` | 605 | Relevés compteurs |
| `app/api/edl/pdf/route.ts` | 396 | Génération document |
| `features/tenant/services/edl.service.ts` | 241 | Service client |
| `app/tenant/inspections/[id]/page.tsx` | 396 | Page tenant |

---

*Rapport généré automatiquement par l'audit Claude - Session 01MNbyjBf2hr44Y5L7PM1yPD*
