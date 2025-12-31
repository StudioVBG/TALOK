export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  generateEDLHTML,
  generateEDLViergeHTML,
  EDLComplet,
} from "@/lib/templates/edl";

/**
 * POST /api/edl/preview
 * Génère l'aperçu HTML d'un état des lieux
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

    if (isVierge) {
      // Générer un template vierge à imprimer
      html = generateEDLViergeHTML(edlData as Partial<EDLComplet>, rooms);
    } else {
      // Générer l'aperçu complet
      // Si on a un edlId, récupérer les données complètes de la BDD
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
          // Récupérer les items de l'EDL
          const { data: items } = await supabase
            .from("edl_items")
            .select("*")
            .eq("edl_id", edlId);

          // Récupérer les médias
          const { data: media } = await supabase
            .from("edl_media")
            .select("*")
            .eq("edl_id", edlId);

          // 🔧 FIX: Récupérer les signatures EDL avec leurs profils
          const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
          );
          
          const { data: signaturesRaw } = await adminClient
            .from("edl_signatures")
            .select("*")
            .eq("edl_id", edlId);
          
          let signatures = signaturesRaw || [];
          
          // Récupérer les profils des signataires
          if (signatures.length > 0) {
            const profileIds = signatures
              .map((s: any) => s.signer_profile_id)
              .filter(Boolean);
            
            if (profileIds.length > 0) {
              const { data: profiles } = await adminClient
                .from("profiles")
                .select("*")
                .in("id", profileIds);
              
              if (profiles) {
                signatures = signatures.map((sig: any) => ({
                  ...sig,
                  profile: profiles.find((p: any) => p.id === sig.signer_profile_id)
                }));
              }
            }
            
            // 🔧 Générer des URLs signées pour les images de signature (bucket privé)
            for (const sig of signatures) {
              if (sig.signature_image_path) {
                const { data: signedUrlData } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(sig.signature_image_path, 3600);
                
                if (signedUrlData?.signedUrl) {
                  (sig as any).signature_image_url = signedUrlData.signedUrl;
                  console.log("[EDL Preview] ✅ Generated signed URL for signature:", sig.signer_role);
                }
              }
            }
          }

          // 🔧 FIX: Récupérer le profil propriétaire avec ADMIN
          const propertyOwnerId = (edl as any).lease?.property?.owner_id;
          const { data: ownerProfile } = await adminClient
            .from("owner_profiles")
            .select("*, profile:profiles(*)")
            .eq("profile_id", propertyOwnerId)
            .single();

          // 🔧 FIX: S'assurer que les signataires du bail ont aussi leurs profils (via ADMIN si besoin)
          if (edl.lease?.signers) {
            const missingProfileIds = edl.lease.signers
              .filter((s: any) => s.profile_id && !s.profile)
              .map((s: any) => s.profile_id);
            
            if (missingProfileIds.length > 0) {
              const { data: leaseProfiles } = await adminClient
                .from("profiles")
                .select("*")
                .in("id", missingProfileIds);
              
              if (leaseProfiles) {
                edl.lease.signers = edl.lease.signers.map((s: any) => ({
                  ...s,
                  profile: s.profile || leaseProfiles.find((p: any) => p.id === s.profile_id)
                }));
              }
            }
          }

          // Construire l'objet EDLComplet
          fullEdlData = mapDatabaseToEDLComplet(
            edl,
            ownerProfile,
            items || [],
            media || [],
            signatures
          );
        }
      }

      html = generateEDLHTML(fullEdlData);
    }

    return NextResponse.json({ html });
  } catch (error: any) {
    console.error("[EDL Preview] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération de l'aperçu" },
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

  // Grouper les items par pièce
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
  
  // Fallback: si on n'a vraiment aucun nom de locataire, chercher dans les signatures
  if ((locataires.length === 0 || locataires.every(l => l.nom_complet === "Locataire")) && signatures.length > 0) {
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

  // Construire le bailleur
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

  // 🔧 FIX: Mapper les signatures au format attendu par le template
  const mappedSignatures = signatures.map((sig: any) => ({
    signer_type: sig.signer_role === "owner" || sig.signer_role === "proprietaire" ? "proprietaire" : "locataire",
    signer_profile_id: sig.signer_profile_id,
    signer_name: sig.signer_name || 
      (sig.profile ? `${sig.profile.prenom || ""} ${sig.profile.nom || ""}`.trim() : "") ||
      (sig.signer_role === "owner" ? "Bailleur" : "Locataire"),
    // Utiliser l'URL signée en priorité
    signature_image: sig.signature_image_url || sig.signature_image || sig.signature_image_path,
    signed_at: sig.signed_at,
    ip_address: sig.ip_inet || sig.ip_address,
    invitation_sent_at: sig.invitation_sent_at,
    invitation_token: sig.invitation_token,
  }));

  console.log("[mapDatabaseToEDLComplet] Mapped signatures:", mappedSignatures.map((s: any) => ({
    type: s.signer_type,
    name: s.signer_name,
    hasImage: !!s.signature_image,
    signed: !!s.signed_at
  })));

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
    cles_remises: edl.keys || undefined,
    signatures: mappedSignatures,
    is_complete: edl.status === "completed" || edl.status === "signed",
    is_signed: edl.status === "signed" || mappedSignatures.filter((s: any) => s.signed_at).length >= 2,
    status: edl.status,
  };
}



