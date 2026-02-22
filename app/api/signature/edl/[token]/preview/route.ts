/**
 * @version 2026-02-22 - Fix: Align with /api/edl/preview for complete data display
 * Uses resolveOwnerIdentity and includes all fields (representant, telephone, keys, etc.)
 */
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import {
  generateEDLHTML,
  EDLComplet,
} from "@/lib/templates/edl";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";

/**
 * POST /api/signature/edl/[token]/preview
 * Génère l'aperçu HTML d'un EDL via token (sans auth requise)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const serviceClient = getServiceClient();

    // 1. Trouver la signature par token
    const { data: signatureEntry, error: sigError } = await serviceClient
      .from("edl_signatures")
      .select("*, edl:edl_id(*)")
      .eq("invitation_token", token)
      .single();

    if (sigError || !signatureEntry) {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    }

    // Vérifier si le token a expiré (7 jours après l'envoi)
    const TOKEN_EXPIRATION_DAYS = 7;
    if ((signatureEntry as any).invitation_sent_at) {
      const sentDate = new Date((signatureEntry as any).invitation_sent_at);
      const expirationDate = new Date(sentDate.getTime() + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() > expirationDate) {
        return NextResponse.json(
          {
            error: "Ce lien d'invitation a expiré. Veuillez demander un nouveau lien au propriétaire.",
            expired_at: expirationDate.toISOString(),
          },
          { status: 410 }
        );
      }
    }

    const edlId = signatureEntry.edl_id;

    // 2. Récupérer les données complètes de l'EDL
    const { data: edl, error } = await serviceClient
      .from("edl")
      .select(`
        *,
        lease:lease_id(
          *,
          property:properties(*),
          signers:lease_signers(
            *,
            profile:profiles(*)
          )
        )
      `)
      .eq("id", edlId)
      .single();

    if (error || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // 3. Récupérer items, médias, signatures, compteurs en parallèle
    const [
      { data: items },
      { data: mediaRaw },
      { data: signaturesRaw },
    ] = await Promise.all([
      serviceClient.from("edl_items").select("*").eq("edl_id", edlId),
      serviceClient.from("edl_media").select("*").eq("edl_id", edlId),
      serviceClient.from("edl_signatures").select("*, profile:profiles(*)").eq("edl_id", edlId),
    ]);

    let media = mediaRaw || [];
    let signatures = signaturesRaw || [];

    // 4. Générer des URLs signées pour les photos des pièces (bucket privé)
    if (media.length > 0) {
      for (const m of media) {
        if (m.storage_path) {
          const { data: signedUrlData } = await serviceClient.storage
            .from("documents")
            .createSignedUrl(m.storage_path, 3600);
          if (signedUrlData?.signedUrl) {
            (m as any).signed_url = signedUrlData.signedUrl;
          }
        }
      }
    }

    // 5. Générer des URLs signées pour les images de signature (bucket privé)
    for (const sig of signatures) {
      if (sig.signature_image_path) {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(sig.signature_image_path, 3600);

        if (signedUrlData?.signedUrl) {
          (sig as any).signature_image_url = signedUrlData.signedUrl;
        }
      }
    }

    // 6. Résoudre l'identité du propriétaire via le résolveur centralisé
    const propertyOwnerId = (edl as any).lease?.property?.owner_id;
    const ownerIdentity = await resolveOwnerIdentity(serviceClient, {
      leaseId: (edl as any).lease_id,
      propertyId: (edl as any).property_id || (edl as any).lease?.property?.id,
      profileId: propertyOwnerId,
    });

    // Build ownerProfile-like object for backward compat with mapDatabaseToEDLComplet
    const ownerProfile = {
      type: ownerIdentity.entityType === "company" ? "societe" : "particulier",
      raison_sociale: ownerIdentity.companyName,
      representant_nom: ownerIdentity.representative
        ? `${ownerIdentity.representative.firstName} ${ownerIdentity.representative.lastName}`.trim()
        : null,
      adresse_facturation: ownerIdentity.billingAddress || ownerIdentity.address.street,
      profile: {
        prenom: ownerIdentity.firstName,
        nom: ownerIdentity.lastName,
        telephone: ownerIdentity.phone,
        email: ownerIdentity.email,
      },
    };

    // 7. S'assurer que les signataires du bail ont aussi leurs profils
    if ((edl as any).lease?.signers) {
      const missingProfileIds = (edl as any).lease.signers
        .filter((s: any) => s.profile_id && !s.profile)
        .map((s: any) => s.profile_id);

      if (missingProfileIds.length > 0) {
        const { data: leaseProfiles } = await serviceClient
          .from("profiles")
          .select("*")
          .in("id", missingProfileIds);

        if (leaseProfiles) {
          (edl as any).lease.signers = (edl as any).lease.signers.map((s: any) => ({
            ...s,
            profile: s.profile || leaseProfiles.find((p: any) => p.id === s.profile_id)
          }));
        }
      }
    }

    // 8. Récupérer les relevés de compteurs
    const { data: meterReadings } = await serviceClient
      .from("edl_meter_readings")
      .select("*, meter:meters(*)")
      .eq("edl_id", edlId);

    // Récupérer tous les compteurs du bien pour inclure ceux sans relevé
    const propertyId = (edl as any).property_id || (edl as any).lease?.property_id || (edl as any).lease?.property?.id;
    let allMeters: any[] = [];
    if (propertyId) {
      const { data: meters } = await serviceClient
        .from("meters")
        .select("*")
        .eq("property_id", propertyId);
      allMeters = meters?.filter((m: any) => m.is_active !== false) || [];
    }

    // Mapper les relevés avec URLs signées
    const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));
    const finalMeterReadings = [];

    for (const r of (meterReadings || [])) {
      const hasValue = r.reading_value !== null && r.reading_value !== undefined;
      const readingDisplay = hasValue ? String(r.reading_value) : (r.photo_path ? "À valider" : "Non relevé");

      let photoUrl = null;
      if (r.photo_path) {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(r.photo_path, 3600);
        photoUrl = signedUrlData?.signedUrl || null;
      }

      finalMeterReadings.push({
        type: r.meter?.type || "electricity",
        meter_number: r.meter?.meter_number || r.meter?.serial_number,
        reading: readingDisplay,
        reading_value: r.reading_value,
        unit: r.reading_unit || r.meter?.unit || "kWh",
        photo_url: photoUrl,
      });
    }

    // Ajouter les compteurs sans relevé
    allMeters.forEach((m: any) => {
      if (!recordedMeterIds.has(m.id)) {
        finalMeterReadings.push({
          type: m.type || "electricity",
          meter_number: m.meter_number || m.serial_number,
          reading: "Non relevé",
          reading_value: null,
          unit: m.unit || "kWh",
          photo_url: null,
        });
      }
    });

    // 9. Construire l'objet EDLComplet
    const fullEdlData = mapDatabaseToEDLComplet(
      { ...edl, meter_readings: finalMeterReadings },
      ownerProfile,
      items || [],
      media,
      signatures
    );

    const html = generateEDLHTML(fullEdlData);

    return NextResponse.json({ html });
  } catch (error: unknown) {
    console.error("[EDL Token Preview] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la génération de l'aperçu" },
      { status: 500 }
    );
  }
}

/**
 * Mappe les données de la base vers le format EDLComplet
 * Aligné avec /api/edl/preview/route.ts pour afficher toutes les données
 */
function mapDatabaseToEDLComplet(
  edl: any,
  ownerProfile: any,
  items: any[],
  media: any[],
  signatures: any[] = []
): EDLComplet {
  const lease = edl.lease;
  const property = lease?.property;

  // Grouper les items par pièce
  const roomsMap = new Map<string, any[]>();
  items.forEach((item) => {
    const roomItems = roomsMap.get(item.room_name) || [];
    const itemPhotos = media
      .filter((m) => m.item_id === item.id && (m.media_type === "photo" || m.type === "photo"))
      .map((m) => (m as any).signed_url || m.storage_path || m.file_path);

    roomItems.push({
      id: item.id,
      room_name: item.room_name,
      item_name: item.item_name,
      condition: item.condition,
      notes: item.notes,
      photos: itemPhotos.length > 0 ? itemPhotos : undefined,
    });
    roomsMap.set(item.room_name, roomItems);
  });

  const pieces = Array.from(roomsMap.entries()).map(([nom, items]) => {
    const roomPhotos = media
      .filter((m) => !m.item_id && (m.room_name === nom || m.section === nom) && (m.media_type === "photo" || m.type === "photo"))
      .map((m) => (m as any).signed_url || m.storage_path || m.file_path);

    return {
      nom,
      items,
      photos: roomPhotos.length > 0 ? roomPhotos : undefined,
    };
  });

  // Extraire les locataires (rôles anglais ET français)
  let locataires =
    lease?.signers
      ?.filter(
        (s: any) =>
          s.role === "tenant" ||
          s.role === "principal" ||
          s.role === "locataire_principal" ||
          s.role === "colocataire" ||
          s.role === "locataire"
      )
      .map((s: any) => {
        const nom = s.profile?.nom || "";
        const prenom = s.profile?.prenom || "";
        const email = s.profile?.email || s.invited_email;
        const telephone = s.profile?.telephone;
        const nomComplet = (prenom || nom)
          ? `${prenom} ${nom}`.trim()
          : s.invited_name || "Locataire";

        return {
          nom,
          prenom,
          nom_complet: nomComplet,
          email,
          telephone,
        };
      }) || [];

  // Fallback: chercher dans les signatures si aucun locataire trouvé
  if ((locataires.length === 0 || locataires.every((l: any) => l.nom_complet === "Locataire")) && signatures.length > 0) {
    const signatureTenants = signatures
      .filter((s: any) => s.signer_role === "tenant" || s.signer_role === "locataire")
      .map((s: any) => ({
        nom: s.profile?.nom || "",
        prenom: s.profile?.prenom || "",
        nom_complet: s.signer_name || (s.profile ? `${s.profile.prenom || ""} ${s.profile.nom || ""}`.trim() : "") || "Locataire",
        email: s.profile?.email,
        telephone: s.profile?.telephone,
      }));

    if (signatureTenants.length > 0) {
      locataires = signatureTenants;
    }
  }

  // Construire le bailleur avec fallbacks robustes
  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale,
    representant: (function () {
      // 1. Représentant explicitement défini
      if (ownerProfile?.representant_nom) return ownerProfile.representant_nom;

      // 2. Nom du profil propriétaire
      const profileName = ownerProfile?.profile?.prenom
        ? `${ownerProfile.profile.prenom} ${ownerProfile.profile.nom || ""}`.trim()
        : null;
      if (profileName) return profileName;

      // 3. Depuis les signataires du bail
      const signers = (edl as any).lease?.signers;
      if (Array.isArray(signers)) {
        const ownerSigner = signers.find((s: any) =>
          s.role === "owner" || s.role === "proprietaire" || s.role === "bailleur"
        );
        if (ownerSigner?.profile?.prenom) {
          return `${ownerSigner.profile.prenom} ${ownerSigner.profile.nom || ""}`.trim();
        }
        if (ownerSigner?.invited_name) return ownerSigner.invited_name;
      }

      // 4. Depuis les signatures EDL
      if (Array.isArray(signatures)) {
        const ownerSig = signatures.find((s: any) =>
          s.signer_role === "owner" || s.signer_role === "proprietaire"
        );
        if (ownerSig?.profile?.prenom) {
          return `${ownerSig.profile.prenom} ${ownerSig.profile.nom || ""}`.trim();
        }
      }

      if (ownerProfile?.type === "societe") {
        console.warn("[EDL Token Preview] Société sans représentant:", ownerProfile?.raison_sociale);
      }

      return undefined;
    })(),
    adresse: ownerProfile?.adresse_facturation,
    telephone: ownerProfile?.profile?.telephone,
    email: ownerProfile?.profile?.email,
  };

  // Mapper les signatures au format attendu par le template
  const mappedSignatures = signatures.map((sig: any) => ({
    signer_type: sig.signer_role === "owner" || sig.signer_role === "proprietaire" ? "proprietaire" : "locataire",
    signer_profile_id: sig.signer_profile_id,
    signer_name: sig.signer_name ||
      (sig.profile ? `${sig.profile.prenom || ""} ${sig.profile.nom || ""}`.trim() : "") ||
      (sig.signer_role === "owner" ? "Bailleur" : "Locataire"),
    signature_image: sig.signature_image_url || sig.signature_image || sig.signature_image_path,
    signed_at: sig.signed_at,
    ip_address: sig.ip_inet || sig.ip_address,
    invitation_sent_at: sig.invitation_sent_at,
    invitation_token: sig.invitation_token,
  }));

  return {
    id: edl.id,
    reference: `EDL-${edl.id.slice(0, 8).toUpperCase()}`,
    type: edl.type,
    scheduled_date: edl.scheduled_at || edl.scheduled_date,
    completed_date: edl.completed_date,
    created_at: edl.created_at,

    logement: {
      adresse_complete: property?.adresse_complete || "",
      code_postal: property?.code_postal || "",
      ville: property?.ville || "",
      type_bien: property?.type || "",
      surface: property?.surface,
      nb_pieces: property?.nb_pieces,
      etage: property?.etage,
      numero_lot: property?.numero_lot,
    },

    bailleur,
    locataires,

    bail: {
      id: lease?.id || "",
      reference: lease?.id
        ? `BAIL-${lease.id.slice(0, 8).toUpperCase()}`
        : undefined,
      type_bail: lease?.type_bail || "",
      date_debut: lease?.date_debut || "",
      date_fin: lease?.date_fin,
      loyer_hc: lease?.loyer || 0,
      charges: lease?.charges_forfaitaires || 0,
    },

    compteurs: edl.meter_readings || [],
    pieces,
    observations_generales: edl.general_notes,
    cles_remises: (edl.keys || []).map((k: any) => ({
      type: k.type,
      quantite: k.quantite || k.quantity || 0,
      notes: k.notes,
    })),
    signatures: mappedSignatures as any,
    is_complete: edl.status === "completed" || edl.status === "signed",
    is_signed: edl.status === "signed" || mappedSignatures.filter((s: any) => s.signed_at).length >= 2,
    status: edl.status,
  };
}
