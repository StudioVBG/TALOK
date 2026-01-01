export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  generateEDLHTML,
  generateEDLViergeHTML,
  EDLComplet,
} from "@/lib/templates/edl";

/**
 * POST /api/edl/pdf
 * Génère le HTML d'un état des lieux pour impression côté client
 * Note: La génération PDF côté serveur avec Puppeteer n'est pas disponible
 * sur Netlify. Le client doit utiliser window.print() ou html2pdf.js
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { edlData, edlId, isVierge, rooms } = body;

    let html: string;
    let fileName: string;

    if (isVierge) {
      // Générer un template vierge à imprimer
      html = generateEDLViergeHTML(edlData as Partial<EDLComplet>, rooms);
      fileName = `edl_template_${new Date().toISOString().slice(0, 10)}.pdf`;
    } else {
      // Générer le HTML complet
      let fullEdlData = edlData as EDLComplet;

      if (edlId) {
        const { data: edl, error } = await supabase
          .from("edl")
          .select(`
            *,
            lease:leases(
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

        if (!error && edl) {
          const { data: items } = await supabase
            .from("edl_items")
            .select("*")
            .eq("edl_id", edlId);

          const { data: media } = await supabase
            .from("edl_media")
            .select("*")
            .eq("edl_id", edlId);

          const propertyOwnerId = (edl as any).lease?.property?.owner_id;
          const { data: ownerProfile } = await supabase
            .from("owner_profiles")
            .select("*, profile:profiles(*)")
            .eq("profile_id", propertyOwnerId)
            .single();

          fullEdlData = mapDatabaseToEDLComplet(
            edl,
            ownerProfile,
            items || [],
            media || []
          );
        }
      }

      html = generateEDLHTML(fullEdlData);
      fileName = `edl_${fullEdlData.type || "entree"}_${
        fullEdlData.reference || new Date().toISOString().slice(0, 10)
      }.pdf`;
    }

    // Retourner le HTML pour génération PDF côté client
    // Le client utilisera html2pdf.js ou window.print()
    return NextResponse.json({
      html,
      fileName,
      fallback: true,
      message: "Utilisez l'impression du navigateur ou html2pdf.js côté client"
    });
  } catch (error: any) {
    console.error("[EDL PDF] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération du HTML" },
      { status: 500 }
    );
  }
}

/**
 * Mappe les données de la base vers le format EDLComplet
 */
function mapDatabaseToEDLComplet(
  edl: any,
  ownerProfile: any,
  items: any[],
  media: any[]
): EDLComplet {
  const lease = edl.lease;
  const property = lease?.property;

  const roomsMap = new Map<string, any[]>();
  items.forEach((item) => {
    const roomItems = roomsMap.get(item.room_name) || [];
    const itemPhotos = media
      .filter((m) => m.item_id === item.id && m.type === "photo")
      .map((m) => m.file_path);

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

  const pieces = Array.from(roomsMap.entries()).map(([nom, items]) => ({
    nom,
    items,
  }));

  const locataires =
    lease?.signers
      ?.filter(
        (s: any) =>
          s.role === "locataire_principal" ||
          s.role === "colocataire" ||
          s.role === "locataire"
      )
      .map((s: any) => ({
        nom: s.profile?.nom || "",
        prenom: s.profile?.prenom || "",
        nom_complet: `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim(),
        email: s.profile?.email,
        telephone: s.profile?.telephone,
      })) || [];

  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale,
    representant: ownerProfile?.representant_nom,
    adresse: ownerProfile?.adresse_facturation,
    telephone: ownerProfile?.profile?.telephone,
    email: ownerProfile?.profile?.email,
  };

  return {
    id: edl.id,
    reference: `EDL-${edl.id.slice(0, 8).toUpperCase()}`,
    type: edl.type,
    scheduled_date: edl.scheduled_date,
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
    cles_remises: edl.keys || undefined,
    signatures: edl.signatures || [],
    is_complete: edl.status === "completed" || edl.status === "signed",
    is_signed: edl.status === "signed",
    status: edl.status,
  };
}



