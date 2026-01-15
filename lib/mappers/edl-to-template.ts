/**
 * Mapper pour transformer les données brutes de la BDD vers le format EDLComplet
 */

import { EDLComplet, EDLItem, EDLMeterReading, EDLSignature } from "@/lib/templates/edl/types";

function getPublicUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return path;
  
  // Les photos sont stockées dans le bucket 'documents'
  return `${supabaseUrl}/storage/v1/object/public/documents/${path}`;
}

interface RawEDL {
  id: string;
  lease_id: string;
  type: "entree" | "sortie";
  status: string;
  scheduled_at?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  general_notes?: string | null;
  lease?: RawLease;
}

interface RawLease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  date_debut: string;
  date_fin?: string | null;
  property?: RawProperty;
  signers?: RawSigner[];
}

interface RawProperty {
  id: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  type: string;
  surface?: number | null;
  nb_pieces?: number | null;
  etage?: string | null;
  numero_lot?: string | null;
  owner_id: string;
}

interface RawSigner {
  profile_id: string;
  role: string;
  profile?: {
    id: string;
    nom: string;
    prenom: string;
    email?: string | null;
    telephone?: string | null;
    date_naissance?: string | null;
    lieu_naissance?: string | null;
    tenant_profile?: {
      locataire_type: string;
      raison_sociale?: string | null;
      representant_legal?: string | null;
      siren?: string | null;
    } | null;
  };
}

interface RawOwnerProfile {
  id: string;
  profile_id: string;
  type: "particulier" | "societe";
  raison_sociale?: string | null;
  representant_nom?: string | null;
  representant_qualite?: string | null;
  siret?: string | null;
  adresse_facturation?: string | null;
  profile?: {
    nom: string;
    prenom: string;
    email?: string | null;
    telephone?: string | null;
  };
}

interface RawEDLItem {
  id: string;
  edl_id: string;
  room_name: string;
  item_name: string;
  condition?: string | null;
  notes?: string | null;
}

interface RawEDLMedia {
  id: string;
  edl_id: string;
  item_id?: string | null;
  file_path: string;
  type: string;
}

interface RawMeterReading {
  type: string;
  meter_number?: string | null;
  // Support both field names: 'reading' (legacy) and 'reading_value' (database)
  reading?: string | null;
  reading_value?: number | null;
  unit?: string;
  reading_unit?: string;
  photo_url?: string | null;
  photo_path?: string | null;
  // Meter info from join
  meter?: {
    type: string;
    meter_number?: string | null;
    unit?: string;
    location?: string | null;
  };
}

interface RawEDLSignature {
  id: string;
  edl_id: string;
  signer_type: string;
  signer_profile_id: string;
  signature_image?: string | null;
  signature_image_path?: string | null;
  signature_image_url?: string | null;  // URL signée générée côté serveur
  signed_at?: string | null;
  ip_address?: string | null;
  ip_inet?: string | null;  // Autre format d'IP
  invitation_sent_at?: string | null;
  invitation_token?: string | null;
  signer_name?: string | null;  // Nom sauvegardé directement
  profile?: {
    id?: string;
    nom: string;
    prenom: string;
    email?: string | null;
    telephone?: string | null;
  };
}

interface RawKeys {
  type: string;
  quantity: number;
  notes?: string | null;
}

/**
 * Mappe les données brutes de la BDD vers le format EDLComplet
 */
export function mapRawEDLToTemplate(
  edl: RawEDL,
  ownerProfile: RawOwnerProfile | null,
  items: RawEDLItem[],
  media: RawEDLMedia[],
  meterReadings: RawMeterReading[],
  signatures: RawEDLSignature[],
  keys: RawKeys[]
): EDLComplet {
  const lease = edl.lease;
  const property = lease?.property || (edl as any).property || (edl as any).property_details;

  // Grouper les items par pièce
  const roomsMap = new Map<string, EDLItem[]>();
  items.forEach((item) => {
    const roomItems = roomsMap.get(item.room_name) || [];
    
    // Trouver les photos associées à cet item
    const itemPhotos = media
      .filter((m) => m.item_id === item.id && (m.type === "photo" || (m as any).media_type === "photo"))
      .map((m) => (m as any).signed_url || getPublicUrl(m.file_path || (m as any).storage_path));

    roomItems.push({
      id: item.id,
      room_name: item.room_name,
      item_name: item.item_name,
      condition: item.condition as EDLItem["condition"],
      notes: item.notes || undefined,
      photos: itemPhotos.length > 0 ? itemPhotos : undefined,
    });
    roomsMap.set(item.room_name, roomItems);
  });

  // Convertir la Map en tableau
  const pieces = Array.from(roomsMap.entries()).map(([nom, items]) => {
    // Trouver les photos globales de la pièce (item_id est nul)
    // 🔧 FIX: Vérifier room_name OU section pour la compatibilité
    const roomPhotos = media
      .filter((m) => !m.item_id && (m.room_name === nom || (m as any).section === nom) && (m.type === "photo" || (m as any).media_type === "photo"))
      .map((m) => (m as any).signed_url || getPublicUrl(m.file_path || (m as any).storage_path));

    return {
      nom,
      items,
      photos: roomPhotos.length > 0 ? roomPhotos : undefined,
    };
  });

  // Extraire les locataires des signataires
  let locataires =
    lease?.signers
      ?.filter(
        (s) =>
          // Rôles en anglais (base de données)
          s.role === "tenant" ||
          s.role === "principal" ||
          // Rôles en français (legacy)
          s.role === "locataire_principal" ||
          s.role === "colocataire" ||
          s.role === "locataire"
      )
      .map((s) => {
        const nom = s.profile?.nom || "";
        const prenom = s.profile?.prenom || "";
        const tp = s.profile?.tenant_profile;
        
        // Logique Société
        const email = s.profile?.email || s.invited_email;
        const telephone = s.profile?.telephone;
        let nomComplet = (prenom || nom) ? `${prenom} ${nom}`.trim() : s.invited_name || "Locataire à définir";
        
        if (tp && tp.locataire_type === "entreprise" && tp.raison_sociale) {
          nomComplet = `${tp.raison_sociale} (Représentée par ${tp.representant_legal || nomComplet})`;
        }

        return {
          nom,
          prenom,
          nom_complet: nomComplet,
          date_naissance: s.profile?.date_naissance || undefined,
          lieu_naissance: s.profile?.lieu_naissance || undefined,
          telephone: telephone || undefined,
          email: email || undefined,
        };
      }) || [];

  // 🔧 FALLBACK: Si aucun locataire trouvé dans le bail, on cherche dans les signatures de l'EDL
  if (locataires.length === 0 && signatures.length > 0) {
    console.log("[mapRawEDLToTemplate] FALLBACK: Cherche locataires dans les signatures EDL");
    locataires = signatures
      .filter(s => s.signer_type === "tenant" || s.signer_type === "locataire")
      .map(s => {
        const nom = s.profile?.nom || "";
        const prenom = s.profile?.prenom || "";
        // Utiliser signer_name si le profil n'est pas disponible
        const nomComplet = (prenom || nom) 
          ? `${prenom} ${nom}`.trim() 
          : s.signer_name || "Locataire";
        
        console.log(`[mapRawEDLToTemplate] Found tenant signature: ${nomComplet}, email: ${s.profile?.email}, tel: ${s.profile?.telephone}`);
        
        return {
          nom,
          prenom,
          nom_complet: nomComplet,
          email: s.profile?.email || undefined,
          telephone: s.profile?.telephone || undefined,
        };
      });
  }

  // ✅ SOTA 2026: Construire le bailleur avec fallbacks robustes
  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale || undefined,
    representant: (function() {
      // 1. Représentant explicitement défini
      if (ownerProfile?.representant_nom) return ownerProfile.representant_nom;
      
      // 2. Nom du profil propriétaire
      const profileName = ownerProfile?.profile?.prenom 
        ? `${ownerProfile.profile.prenom} ${ownerProfile.profile.nom || ""}`.trim()
        : null;
      if (profileName) return profileName;
      
      // 3. Depuis les signataires du bail (lease)
      const signers = (edl as any).lease?.signers;
      if (Array.isArray(signers)) {
        const ownerSigner = signers.find((s: any) => 
          s.role === 'owner' || s.role === 'proprietaire' || s.role === 'bailleur'
        );
        if (ownerSigner?.profile?.prenom) {
          return `${ownerSigner.profile.prenom} ${ownerSigner.profile.nom || ""}`.trim();
        }
        // Fallback sur invited_name si pas de profil
        if (ownerSigner?.invited_name) return ownerSigner.invited_name;
      }
      
      // 4. Depuis les signatures EDL
      const edlSignatures = (edl as any).edl_signatures || signatures;
      if (Array.isArray(edlSignatures)) {
        const ownerSig = edlSignatures.find((s: any) => 
          s.signer_role === 'owner' || s.signer_role === 'proprietaire'
        );
        if (ownerSig?.profile?.prenom) {
          return `${ownerSig.profile.prenom} ${ownerSig.profile.nom || ""}`.trim();
        }
      }
      
      // Debug si pas de représentant trouvé pour une société
      if (ownerProfile?.type === "societe") {
        console.warn("[edl-to-template] ⚠️ Société sans représentant trouvé:", ownerProfile?.raison_sociale);
      }
      
      return undefined;
    })(),
    adresse: ownerProfile?.adresse_facturation || undefined,
    telephone: ownerProfile?.profile?.telephone || undefined,
    email: ownerProfile?.profile?.email || undefined,
  };

  // Convertir les compteurs - gère les deux formats (legacy et BDD)
  const compteurs: EDLMeterReading[] = meterReadings.map((m) => {
    // 🔧 FIX: Résoudre la valeur du relevé avec fallbacks
    // La BDD utilise 'reading_value', mais certains flux utilisent 'reading'
    const readingValue = m.reading_value !== undefined && m.reading_value !== null
      ? String(m.reading_value)
      : m.reading || "Non relevé";

    // Résoudre le type de compteur (peut venir du meter join ou directement)
    const meterType = m.meter?.type || m.type;

    // Résoudre le numéro de compteur
    const meterNumber = m.meter?.meter_number || m.meter_number;

    // Résoudre l'unité
    const unit = m.reading_unit || m.unit || m.meter?.unit || "kWh";

    // Résoudre la photo
    const photoPath = m.photo_url || m.photo_path;

    return {
      type: meterType as EDLMeterReading["type"],
      meter_number: meterNumber || undefined,
      reading: readingValue,
      unit: unit,
      photo_url: photoPath ? getPublicUrl(photoPath) : undefined,
    };
  });

  // ✅ SOTA 2026: Convertir les signatures avec gestion robuste des URLs
  const edlSignatures: EDLSignature[] = signatures.map((sig) => {
    // Résoudre l'URL de signature avec priorité claire
    let signatureImage: string | undefined = undefined;
    
    // 1. URL signée (priorité maximale pour buckets privés)
    if (sig.signature_image_url && sig.signature_image_url.startsWith("http")) {
      signatureImage = sig.signature_image_url;
    }
    // 2. signature_image si c'est déjà une URL ou data:image
    else if (sig.signature_image && (sig.signature_image.startsWith("data:") || sig.signature_image.startsWith("http"))) {
      signatureImage = sig.signature_image;
    }
    // 3. Générer une URL publique à partir du path (fallback)
    else if (sig.signature_image_path) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        // Note: ceci ne fonctionnera que si le bucket est public ou si une URL signée est générée côté serveur
        signatureImage = `${supabaseUrl}/storage/v1/object/public/documents/${sig.signature_image_path}`;
      }
    }
    
    // Debug: logger si pas d'image trouvée pour une signature existante
    if (!signatureImage && sig.signed_at) {
      console.warn(`[edl-to-template] ⚠️ Signature ${sig.signer_role} signée mais pas d'image:`, {
        hasUrl: !!sig.signature_image_url,
        hasImage: !!sig.signature_image,
        hasPath: !!sig.signature_image_path,
      });
    }

    return {
      signer_type: (sig.signer_role === "owner" || sig.signer_role === "proprietaire" ? "owner" : "tenant") as any,
      signer_profile_id: sig.signer_profile_id,
      signer_name: sig.profile 
        ? `${sig.profile.prenom || ""} ${sig.profile.nom || ""}`.trim()
        : sig.signer_role === "owner" || sig.signer_role === "proprietaire" ? "Bailleur" : "Locataire",
      signature_image: signatureImage,
      signed_at: sig.signed_at || undefined,
      ip_address: sig.ip_inet || sig.ip_address || undefined,
      invitation_sent_at: sig.invitation_sent_at || undefined,
      invitation_token: sig.invitation_token || undefined,
      proof_id: (sig as any).proof_id || undefined,
      proof_metadata: (sig as any).proof_metadata || undefined,
      document_hash: (sig as any).document_hash || undefined,
    };
  });

  // Convertir les clés
  const clesRemises = keys.map((k: any) => ({
    type: k.type,
    quantite: k.quantite || k.quantity || 0, // Gère quantite et quantity
    notes: k.notes || undefined,
  }));

  // Déterminer si l'EDL est complet et signé
  const isComplete = edl.status === "completed" || edl.status === "signed";
  const isSigned =
    edl.status === "signed" ||
    (edlSignatures.filter((s) => s.signed_at).length >= 2);

  return {
    id: edl.id,
    reference: `EDL-${edl.id.slice(0, 8).toUpperCase()}`,
    type: edl.type,
    scheduled_date: edl.scheduled_at || edl.scheduled_date || undefined,
    completed_date: edl.completed_date || undefined,
    created_at: edl.created_at,

    logement: {
      adresse_complete: property?.adresse_complete || "",
      code_postal: property?.code_postal || "",
      ville: property?.ville || "",
      type_bien: property?.type || "",
      surface: property?.surface || undefined,
      nb_pieces: property?.nb_pieces || undefined,
      etage: property?.etage || undefined,
      numero_lot: property?.numero_lot || undefined,
    },

    bailleur,
    locataires,

    bail: {
      id: lease?.id || "",
      reference: lease?.id ? `BAIL-${lease.id.slice(0, 8).toUpperCase()}` : undefined,
      type_bail: lease?.type_bail || "",
      date_debut: lease?.date_debut || "",
      date_fin: lease?.date_fin || undefined,
      loyer_hc: lease?.loyer || 0,
      charges: lease?.charges_forfaitaires || 0,
    },

    compteurs,
    pieces,
    observations_generales: edl.general_notes || undefined,
    cles_remises: clesRemises.length > 0 ? clesRemises : undefined,
    signatures: edlSignatures,
    is_complete: isComplete,
    is_signed: isSigned,
    status: edl.status as EDLComplet["status"],
  };
}

/**
 * Génère une référence unique pour l'EDL
 */
export function generateEDLReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EDL-${timestamp}-${random}`;
}

export default mapRawEDLToTemplate;


