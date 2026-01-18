export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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
        // 🔧 Utiliser adminClient pour garantir la lecture des données et la génération des URLs signées
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        const { data: edl, error } = await adminClient
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
          const { data: items } = await adminClient
            .from("edl_items")
            .select("*")
            .eq("edl_id", edlId);

          const { data: mediaRaw } = await adminClient
            .from("edl_media")
            .select("*")
            .eq("edl_id", edlId);
          
          let media = mediaRaw || [];

          // 🔧 Générer des URLs signées pour les photos (bucket privé)
          if (media.length > 0) {
            for (const m of media) {
              if (m.storage_path) {
                const { data: signedUrlData } = await adminClient.storage
                  .from("documents")
                  .createSignedUrl(m.storage_path, 3600);
                
                if (signedUrlData?.signedUrl) {
                  (m as any).signed_url = signedUrlData.signedUrl;
                }
              }
            }
          }

          const { data: signaturesRaw } = await adminClient
            .from("edl_signatures")
            .select("*")
            .eq("edl_id", edlId);
          
          let signatures = signaturesRaw || [];
          
          // Récupérer les profils et images de signature signées
          if (signatures.length > 0) {
            const profileIds = signatures.map((s: any) => s.signer_profile_id).filter(Boolean);
            if (profileIds.length > 0) {
              const { data: profiles } = await adminClient.from("profiles").select("*").in("id", profileIds);
              if (profiles) {
                signatures = signatures.map((sig: any) => ({
                  ...sig,
                  profile: profiles.find((p: any) => p.id === sig.signer_profile_id)
                }));
              }
            }

            for (const sig of signatures) {
              if (sig.signature_image_path) {
                const { data: signedUrlData } = await adminClient.storage
                  .from("documents")
                  .createSignedUrl(sig.signature_image_path, 3600);
                if (signedUrlData?.signedUrl) {
                  (sig as any).signature_image_url = signedUrlData.signedUrl;
                }
              }
            }
          }

          const propertyOwnerId = (edl as any).lease?.property?.owner_id;
          const { data: ownerProfile } = await adminClient
            .from("owner_profiles")
            .select("*, profile:profiles(*)")
            .eq("profile_id", propertyOwnerId)
            .single();

          const { data: meterReadings } = await adminClient
            .from("edl_meter_readings")
            .select("*, meter:meters(*)")
            .eq("edl_id", edlId);

          console.log(`[EDL PDF] Found ${meterReadings?.length || 0} meter readings for EDL ${edlId}`);

          // 🔧 FIX: Récupérer tous les compteurs du bien pour les inclure dans le PDF même sans relevé
          const propertyId = (edl as any).property_id || (edl as any).lease?.property_id || (edl as any).lease?.property?.id;
          console.log(`[EDL PDF] Property ID for meters: ${propertyId}`);

          let allMeters: any[] = [];
          if (propertyId) {
            const { data: meters } = await adminClient
              .from("meters")
              .select("*")
              .eq("property_id", propertyId);

            // Filtrer en JS pour éviter l'erreur si la colonne is_active n'existe pas
            allMeters = meters?.filter(m => m.is_active !== false) || [];
            console.log(`[EDL PDF] Found ${allMeters.length} active meters for property ${propertyId}`);
          }

          // 🔧 FIX AMÉLIORÉ: Mapper les relevés existants
          // Les compteurs des relevés sont la source de vérité pour les valeurs
          const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));

          // Créer un Set des types de compteurs déjà relevés pour éviter les doublons par type
          const recordedMeterTypes = new Set(
            (meterReadings || []).map((r: any) => r.meter?.type || "electricity")
          );

          const finalMeterReadings = (meterReadings || []).map((r: any) => ({
            type: r.meter?.type || "electricity",
            meter_number: r.meter?.meter_number || r.meter?.serial_number,
            reading: String(r.reading_value),
            unit: r.reading_unit || r.meter?.unit || "kWh",
            photo_url: r.photo_path,
          }));

          // Ajouter les compteurs manquants avec mention "À relever"
          // Vérifier à la fois par ID ET par type pour éviter les doublons
          allMeters.forEach((m: any) => {
            const alreadyRecordedById = recordedMeterIds.has(m.id);
            const alreadyRecordedByType = recordedMeterTypes.has(m.type) && !alreadyRecordedById;

            if (!alreadyRecordedById && !alreadyRecordedByType) {
              finalMeterReadings.push({
                type: m.type || "electricity",
                meter_number: m.meter_number || m.serial_number,
                reading: "Non relevé", // Utilisé par le template pour afficher "À relever"
                unit: m.unit || "kWh",
                photo_url: null,
              });
            }
          });

          console.log(`[EDL PDF] Final meter readings count: ${finalMeterReadings.length}`);

          fullEdlData = mapDatabaseToEDLComplet(
            { ...edl, meter_readings: finalMeterReadings },
            ownerProfile,
            items || [],
            media || [],
            signatures
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
  } catch (error: unknown) {
    console.error("[EDL PDF] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la génération du HTML" },
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
  media: any[],
  signatures: any[] = []
): EDLComplet {
  const lease = edl.lease;
  const property = lease?.property;

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
    // Capturer les photos globales de la pièce (item_id est nul)
    // 🔧 FIX: Vérifier room_name OU section pour la compatibilité
    const roomPhotos = media
      .filter((m) => !m.item_id && (m.room_name === nom || m.section === nom) && (m.media_type === "photo" || m.type === "photo"))
      .map((m) => (m as any).signed_url || m.storage_path || m.file_path);

    return {
      nom,
      items,
      photos: roomPhotos.length > 0 ? roomPhotos : undefined,
    };
  });

  const locataires =
    lease?.signers
      ?.filter(
        (s: any) =>
          s.role === "locataire_principal" ||
          s.role === "colocataire" ||
          s.role === "locataire" ||
          s.role === "tenant"
      )
      .map((s: any) => ({
        nom: s.profile?.nom || "",
        prenom: s.profile?.prenom || "",
        nom_complet: `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim() || s.invited_name || "Locataire",
        email: s.profile?.email || s.invited_email,
        telephone: s.profile?.telephone,
      })) || [];

  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale,
    representant: (function() {
      if (ownerProfile?.representant_nom) return ownerProfile.representant_nom;
      if (ownerProfile?.profile?.prenom) return `${ownerProfile.profile.prenom} ${ownerProfile.profile.nom}`.trim();
      
      const signers = (edl as any).lease?.signers;
      if (Array.isArray(signers)) {
        const ownerSigner = signers.find((s: any) => s.role === 'owner' || s.role === 'proprietaire');
        if (ownerSigner?.profile) return `${ownerSigner.profile.prenom} ${ownerSigner.profile.nom}`.trim();
      }
      
      return undefined;
    })(),
    adresse: ownerProfile?.adresse_facturation,
    telephone: ownerProfile?.profile?.telephone,
    email: ownerProfile?.profile?.email,
  };

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
    signatures: mappedSignatures,
    is_complete: edl.status === "completed" || edl.status === "signed",
    is_signed: edl.status === "signed" || mappedSignatures.filter((s: any) => s.signed_at).length >= 2,
    status: edl.status,
  };
}



