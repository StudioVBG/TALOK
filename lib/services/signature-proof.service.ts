/**
 * Service de génération de preuve de signature électronique
 *
 * Conforme au règlement eIDAS et à l'Article 1367 du Code Civil français
 *
 * Génère une preuve cryptographique contenant :
 * - Hash SHA-256 du document
 * - Horodatage local + horodatage certifié TSA (RFC 3161)
 * - Métadonnées du signataire
 * - Signature du signataire (image base64)
 */

import { timestampSignatureProof } from "./tsa.service";

export interface SignatureProof {
  // Identifiant unique de la preuve
  proofId: string;

  // Document signé
  document: {
    type: string;
    id: string;
    hash: string; // SHA-256 du contenu
  };

  // Signataire
  signer: {
    name: string;
    email: string;
    profileId?: string;
    identityVerified: boolean;
    identityMethod?: string;
  };

  // Signature
  signature: {
    type: "draw" | "text";
    imageData: string; // Base64
    hash: string; // SHA-256 de l'image
  };

  // Horodatage
  timestamp: {
    iso: string;
    unix: number;
    timezone: string;
  };

  // Horodatage certifié (TSA RFC 3161)
  tsa?: {
    token: string;
    provider: string;
    status: "granted" | "rejection" | "waiting" | "fallback";
    fallbackUsed: boolean;
    timestampedAt: string;
  };

  // Métadonnées techniques
  metadata: {
    ipAddress?: string;
    userAgent: string;
    screenSize: string;
    touchDevice: boolean;
    geolocation?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  };

  // Intégrité
  integrity: {
    algorithm: "SHA-256";
    proofHash: string; // Hash de toute la preuve
  };
}

/**
 * Génère un hash SHA-256 d'une chaîne
 */
export async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Génère un identifiant unique pour la preuve
 */
function generateProofId(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.getRandomValues(new Uint8Array(6));
  const random = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `SIG-${timestamp}-${random}`.toUpperCase();
}

/**
 * Génère une preuve de signature complète
 */
export async function generateSignatureProof(params: {
  documentType: string;
  documentId: string;
  documentContent: string;
  signerName: string;
  signerEmail: string;
  signerProfileId?: string;
  identityVerified: boolean;
  identityMethod?: string;
  signatureType: "draw" | "text";
  signatureImage: string;
  userAgent: string;
  screenSize: string;
  touchDevice: boolean;
  ipAddress?: string;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
}): Promise<SignatureProof> {
  // Générer les hash
  const documentHash = await generateHash(params.documentContent);
  const signatureHash = await generateHash(params.signatureImage);
  
  // Créer la preuve
  const proof: Omit<SignatureProof, "integrity"> = {
    proofId: generateProofId(),
    document: {
      type: params.documentType,
      id: params.documentId,
      hash: documentHash,
    },
    signer: {
      name: params.signerName,
      email: params.signerEmail,
      profileId: params.signerProfileId,
      identityVerified: params.identityVerified,
      identityMethod: params.identityMethod,
    },
    signature: {
      type: params.signatureType,
      imageData: params.signatureImage,
      hash: signatureHash,
    },
    timestamp: {
      iso: new Date().toISOString(),
      unix: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    metadata: {
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      screenSize: params.screenSize,
      touchDevice: params.touchDevice,
      geolocation: params.geolocation,
    },
  };
  
  // Générer le hash de la preuve complète (sans l'image pour réduire la taille)
  const proofForHash = {
    ...proof,
    signature: {
      ...proof.signature,
      imageData: "[IMAGE_HASH:" + signatureHash + "]",
    },
  };
  const proofHash = await generateHash(JSON.stringify(proofForHash));

  // Demander un horodatage certifié TSA (RFC 3161)
  let tsa: SignatureProof["tsa"] = undefined;
  try {
    const tsaResult = await timestampSignatureProof(proofHash);
    if (tsaResult.success && tsaResult.token) {
      tsa = {
        token: tsaResult.token.token,
        provider: tsaResult.token.provider,
        status: tsaResult.token.status,
        fallbackUsed: tsaResult.fallbackUsed,
        timestampedAt: tsaResult.token.timestamp,
      };
    }
  } catch (tsaError) {
    console.warn("[SignatureProof] TSA horodatage indisponible:", tsaError);
  }

  return {
    ...proof,
    tsa,
    integrity: {
      algorithm: "SHA-256",
      proofHash,
    },
  };
}

/**
 * Vérifie l'intégrité d'une preuve de signature
 */
export async function verifySignatureProof(proof: SignatureProof): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Vérifier le hash de la signature
  const signatureHash = await generateHash(proof.signature.imageData);
  if (signatureHash !== proof.signature.hash) {
    errors.push("Le hash de la signature ne correspond pas");
  }
  
  // Vérifier le hash de la preuve
  const proofForHash = {
    ...proof,
    integrity: undefined,
    signature: {
      ...proof.signature,
      imageData: "[IMAGE_HASH:" + proof.signature.hash + "]",
    },
  };
  delete (proofForHash as any).integrity;
  const proofHash = await generateHash(JSON.stringify(proofForHash));
  
  if (proofHash !== proof.integrity.proofHash) {
    errors.push("Le hash de la preuve ne correspond pas - document potentiellement altéré");
  }
  
  // Vérifier l'horodatage (pas dans le futur)
  if (proof.timestamp.unix > Date.now() + 60000) {
    errors.push("L'horodatage est dans le futur");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Génère un certificat de signature au format texte
 */
export function generateSignatureCertificate(proof: SignatureProof): string {
  return `
═══════════════════════════════════════════════════════════════════
                    CERTIFICAT DE SIGNATURE ÉLECTRONIQUE
═══════════════════════════════════════════════════════════════════

Référence : ${proof.proofId}
Date : ${new Date(proof.timestamp.iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}

───────────────────────────────────────────────────────────────────
DOCUMENT SIGNÉ
───────────────────────────────────────────────────────────────────
Type : ${proof.document.type}
Identifiant : ${proof.document.id}
Empreinte SHA-256 : ${proof.document.hash}

───────────────────────────────────────────────────────────────────
SIGNATAIRE
───────────────────────────────────────────────────────────────────
Nom : ${proof.signer.name}
Email : ${proof.signer.email}
Identité vérifiée : ${proof.signer.identityVerified ? "Oui" : "Non"}
${proof.signer.identityMethod ? `Méthode : ${proof.signer.identityMethod}` : ""}

───────────────────────────────────────────────────────────────────
SIGNATURE
───────────────────────────────────────────────────────────────────
Type : ${proof.signature.type === "draw" ? "Manuscrite (tracé)" : "Typographique"}
Empreinte SHA-256 : ${proof.signature.hash}

───────────────────────────────────────────────────────────────────
MÉTADONNÉES TECHNIQUES
───────────────────────────────────────────────────────────────────
Horodatage Unix : ${proof.timestamp.unix}
Fuseau horaire : ${proof.timestamp.timezone}
Appareil tactile : ${proof.metadata.touchDevice ? "Oui" : "Non"}
Résolution écran : ${proof.metadata.screenSize}
${proof.metadata.ipAddress ? `Adresse IP : ${proof.metadata.ipAddress}` : ""}

───────────────────────────────────────────────────────────────────
INTÉGRITÉ
───────────────────────────────────────────────────────────────────
Algorithme : ${proof.integrity.algorithm}
Empreinte de la preuve : ${proof.integrity.proofHash}
${proof.tsa ? `
───────────────────────────────────────────────────────────────────
HORODATAGE CERTIFIÉ (RFC 3161)
───────────────────────────────────────────────────────────────────
Fournisseur : ${proof.tsa.provider}
Statut : ${proof.tsa.status === "granted" ? "Certifié" : proof.tsa.status === "fallback" ? "Fallback local" : proof.tsa.status}
Horodaté à : ${proof.tsa.timestampedAt}
${proof.tsa.fallbackUsed ? "⚠ Horodatage local (TSA indisponible)" : "✓ Horodatage certifié par un tiers de confiance"}
` : ""}
═══════════════════════════════════════════════════════════════════
Ce certificat atteste que le signataire a apposé sa signature
électronique sur le document identifié ci-dessus, conformément
au règlement eIDAS (UE) n°910/2014 et à l'article 1367 du Code Civil.
═══════════════════════════════════════════════════════════════════
`.trim();
}

