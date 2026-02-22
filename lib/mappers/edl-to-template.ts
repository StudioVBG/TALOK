/**
 * Mapper: données base EDL -> format EDLComplet pour génération HTML/PDF
 * Partagé entre API preview, API PDF et page signature EDL (évite duplication)
 */

import type { EDLComplet } from "@/lib/templates/edl";

function photoUrl(m: any): string {
  return (m?.signed_url ?? m?.storage_path ?? m?.file_path) || "";
}

export function mapDatabaseToEDLComplet(
  edl: any,
  ownerProfile: any,
  items: any[],
  media: any[],
  signatures: any[] = []
): EDLComplet {
  const lease = edl.lease;
  const property = lease?.property || edl.property_details;

  const roomsMap = new Map<string, any[]>();
  items.forEach((item) => {
    const roomItems = roomsMap.get(item.room_name) || [];
    const itemPhotos = media
      .filter((m) => m.item_id === item.id && (m.media_type === "photo" || m.type === "photo"))
      .map((m) => photoUrl(m))
      .filter(Boolean);
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

  const pieces = Array.from(roomsMap.entries()).map(([nom, roomItems]) => {
    const roomPhotos = media
      .filter(
        (m) =>
          !m.item_id &&
          (m.room_name === nom || m.section === nom) &&
          (m.media_type === "photo" || m.type === "photo")
      )
      .map((m) => photoUrl(m))
      .filter(Boolean);
    return {
      nom,
      items: roomItems,
      ...(roomPhotos.length > 0 && { photos: roomPhotos }),
    };
  });

  let locataires =
    lease?.signers
      ?.filter((s: any) =>
        ["tenant", "principal", "locataire_principal", "colocataire", "locataire"].includes(s.role)
      )
      .map((s: any) => ({
        nom: s.profile?.nom || "",
        prenom: s.profile?.prenom || "",
        nom_complet:
          `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim() || s.invited_name || "Locataire",
        email: s.profile?.email || s.invited_email,
        telephone: s.profile?.telephone,
      })) || [];

  if (
    (locataires.length === 0 || locataires.every((l: any) => !l.nom_complet || l.nom_complet === "Locataire")) &&
    signatures.length > 0
  ) {
    const fromSigs = signatures
      .filter((s: any) => s.signer_role === "tenant" || s.signer_role === "locataire")
      .map((s: any) => ({
        nom: s.profile?.nom || "",
        prenom: s.profile?.prenom || "",
        nom_complet:
          (s as any).signer_name ||
          `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim() ||
          "Locataire",
        email: s.profile?.email,
        telephone: s.profile?.telephone,
      }));
    if (fromSigs.length > 0) locataires = fromSigs;
  }

  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale,
    representant: (() => {
      if (ownerProfile?.representant_nom) return ownerProfile.representant_nom;
      if (ownerProfile?.profile?.prenom)
        return `${ownerProfile.profile.prenom} ${ownerProfile.profile.nom || ""}`.trim();
      const signers = (edl as any).lease?.signers;
      if (Array.isArray(signers)) {
        const ownerSigner = signers.find(
          (s: any) => s.role === "owner" || s.role === "proprietaire" || s.role === "bailleur"
        );
        if (ownerSigner?.profile)
          return `${ownerSigner.profile.prenom || ""} ${ownerSigner.profile.nom || ""}`.trim();
        if (ownerSigner?.invited_name) return ownerSigner.invited_name;
      }
      if (Array.isArray(signatures)) {
        const ownerSig = signatures.find(
          (s: any) => s.signer_role === "owner" || s.signer_role === "proprietaire"
        );
        if (ownerSig?.profile)
          return `${ownerSig.profile.prenom || ""} ${ownerSig.profile.nom || ""}`.trim();
      }
      return undefined;
    })(),
    adresse: ownerProfile?.adresse_facturation,
    telephone: ownerProfile?.profile?.telephone,
    email: ownerProfile?.profile?.email,
  };

  const mappedSignatures = signatures.map((sig: any) => ({
    signer_type: ["owner", "proprietaire"].includes(sig.signer_role) ? "proprietaire" : "locataire",
    signer_name:
      (sig as any).signer_name ||
      `${sig.profile?.prenom || ""} ${sig.profile?.nom || ""}`.trim() ||
      (sig.signer_role === "owner" ? "Bailleur" : "Locataire"),
    signed_at: sig.signed_at,
    signature_image: (sig as any).signature_image_url || (sig as any).signature_image || sig.signature_image_path,
  }));

  const hasOwnerSig = signatures.some(
    (s: any) => ["owner", "proprietaire"].includes(s.signer_role) && s.signed_at
  );
  const hasTenantSig = signatures.some(
    (s: any) => ["tenant", "locataire", "locataire_principal"].includes(s.signer_role) && s.signed_at
  );
  const isComplete = edl.status === "completed" || edl.status === "signed";
  const isSigned = hasOwnerSig && hasTenantSig;

  return {
    id: edl.id,
    reference:
      edl.reference ||
      `EDL-${(edl.id?.slice && edl.id.slice(0, 8)) || Date.now().toString(36).toUpperCase()}`,
    type: edl.type,
    scheduled_date: edl.scheduled_at || edl.scheduled_date,
    completed_date: edl.completed_date,
    created_at: edl.created_at || new Date().toISOString(),
    logement: {
      adresse_complete: property?.adresse_complete || "",
      ville: property?.ville || "",
      code_postal: property?.code_postal || "",
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
        : lease?.reference,
      type_bail: lease?.type_bail || "nu",
      date_debut: lease?.date_debut || "",
      date_fin: lease?.date_fin,
      loyer_hc: lease?.loyer || 0,
      charges: lease?.charges_forfaitaires || 0,
    },
    compteurs: edl.meter_readings || [],
    pieces,
    observations_generales: edl.general_notes,
    cles_remises: Array.isArray(edl.keys)
      ? edl.keys.map((k: any) => ({
          type: k.type || "",
          quantite: k.quantite ?? k.quantity ?? 0,
          notes: k.notes ?? k.observations,
        }))
      : undefined,
    signatures: mappedSignatures as any,
    is_complete: isComplete,
    is_signed: isSigned || edl.status === "signed",
    status: edl.status || "draft",
  };
}
