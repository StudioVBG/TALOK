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
        // 🔧 Utiliser adminClient pour garantir la lecture des données pour l'aperçu
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
          // Récupérer les items de l'EDL
          const { data: items } = await adminClient
            .from("edl_items")
            .select("*")
            .eq("edl_id", edlId);

          // Récupérer les médias
          const { data: mediaRaw, error: mediaError } = await adminClient
            .from("edl_media")
            .select("*")
            .eq("edl_id", edlId);
          
          if (mediaError) console.error("[EDL Preview] Error fetching media:", mediaError);
          
          let media = mediaRaw || [];
          console.log(`[EDL Preview] Found ${media.length} media records for EDL ${edlId}`);

          // 🔧 Générer des URLs signées pour les photos des pièces (bucket privé)
          if (media.length > 0) {
            for (const m of media) {
              if (m.storage_path) {
                const { data: signedUrlData, error: signError } = await adminClient.storage
                  .from("documents")
                  .createSignedUrl(m.storage_path, 3600);
                
                if (signError) console.warn(`[EDL Preview] Error signing URL for ${m.storage_path}:`, signError);
                
                if (signedUrlData?.signedUrl) {
                  (m as any).signed_url = signedUrlData.signedUrl;
                  console.log(`[EDL Preview] ✅ Signed media URL: ${m.storage_path}`);
                }
              }
            }
          }
          
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
            // Utiliser adminClient pour garantir l'accès aux fichiers, même si RLS est strict
            for (const sig of signatures) {
              if (sig.signature_image_path) {
                const { data: signedUrlData } = await adminClient.storage
                  .from("documents")
                  .createSignedUrl(sig.signature_image_path, 3600);
                
                if (signedUrlData?.signedUrl) {
                  (sig as any).signature_image_url = signedUrlData.signedUrl;
                  console.log("[EDL Preview] ✅ Generated signed URL for signature (ADMIN):", sig.signer_role);
                }
              } else if (sig.signer_role === 'tenant' && sig.signed_at) {
                // 🔧 FALLBACK: Si la signature EDL est manquante mais que le locataire a signé le bail,
                // on cherche son image de signature dans le dossier du bail.
                console.log("[EDL Preview] 🔧 No EDL signature image path, searching lease signatures for tenant...");
                const leaseId = (edl as any).lease_id;
                const userId = sig.signer_user;
                
                if (leaseId && userId) {
                  const { data: leaseFiles } = await adminClient.storage
                    .from("documents")
                    .list(`signatures/${leaseId}`);
                  
                  const tenantLeaseFile = leaseFiles?.find(f => f.name.startsWith(userId));
                  if (tenantLeaseFile) {
                    const fallbackPath = `signatures/${leaseId}/${tenantLeaseFile.name}`;
                    console.log("[EDL Preview] 🔧 Found fallback signature image from lease:", fallbackPath);
                    const { data: signedUrlData } = await adminClient.storage
                      .from("documents")
                      .createSignedUrl(fallbackPath, 3600);
                    
                    if (signedUrlData?.signedUrl) {
                      (sig as any).signature_image_url = signedUrlData.signedUrl;
                      console.log("[EDL Preview] ✅ Generated FALLBACK signed URL for tenant signature");
                    }
                  }
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

          // Récupérer les relevés de compteurs
          const { data: meterReadings } = await adminClient
            .from("edl_meter_readings")
            .select("*, meter:meters(*)")
            .eq("edl_id", edlId);

          console.log(`[EDL Preview] Found ${meterReadings?.length || 0} meter readings for EDL ${edlId}`);

          // 🔧 FIX: Récupérer tous les compteurs du bien pour les inclure dans l'aperçu même sans relevé
          const propertyId = (edl as any).property_id || (edl as any).lease?.property_id || (edl as any).lease?.property?.id;
          console.log(`[EDL Preview] Property ID for meters: ${propertyId}`);

          let allMeters: any[] = [];
          if (propertyId) {
            const { data: meters } = await adminClient
              .from("meters")
              .select("*")
              .eq("property_id", propertyId);

            // Filtrer en JS pour éviter l'erreur si la colonne is_active n'existe pas
            allMeters = meters?.filter(m => m.is_active !== false) || [];
            console.log(`[EDL Preview] Found ${allMeters.length} active meters for property ${propertyId}`);
          }

          // 🔧 FIX AMÉLIORÉ: Mapper les relevés existants avec URLs signées
          // Les compteurs des relevés sont la source de vérité pour les valeurs
          const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));

          console.log(`[EDL Preview] Recorded meter IDs: ${Array.from(recordedMeterIds).join(', ')}`);

          // 🔧 FIX: Générer des URLs signées pour les photos des compteurs
          const finalMeterReadings = [];
          for (const r of (meterReadings || [])) {
            // 🔧 FIX: Gérer les valeurs null/undefined - afficher "À valider" si photo mais pas de valeur
            const hasValue = r.reading_value !== null && r.reading_value !== undefined;
            const readingDisplay = hasValue ? String(r.reading_value) : (r.photo_path ? "À valider" : "Non relevé");

            let photoUrl = null;
            if (r.photo_path) {
              const { data: signedUrlData } = await adminClient.storage
                .from("documents")
                .createSignedUrl(r.photo_path, 3600);
              photoUrl = signedUrlData?.signedUrl || null;
              if (photoUrl) {
                console.log(`[EDL Preview] ✅ Signed meter photo URL: ${r.photo_path}`);
              }
            }

            finalMeterReadings.push({
              type: r.meter?.type || "electricity",
              meter_number: r.meter?.meter_number || r.meter?.serial_number,
              reading: readingDisplay,
              reading_value: r.reading_value, // Conserver la valeur numérique originale
              unit: r.reading_unit || r.meter?.unit || "kWh",
              photo_url: photoUrl,
            });
          }

          // 🔧 FIX: Ajouter les compteurs manquants - vérifier uniquement par ID
          // Ne plus vérifier par type pour éviter de masquer des compteurs multiples du même type
          allMeters.forEach((m: any) => {
            const alreadyRecordedById = recordedMeterIds.has(m.id);

            console.log(`[EDL Preview] Checking meter ${m.id} (${m.type}): recorded=${alreadyRecordedById}`);

            if (!alreadyRecordedById) {
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

          console.log(`[EDL Preview] Final meter readings count: ${finalMeterReadings.length}`);

          // Construire l'objet EDLComplet
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
    }

    return NextResponse.json({ html });
  } catch (error: unknown) {
    console.error("[EDL Preview] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la génération de l'aperçu" },
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
      .filter((m) => m.item_id === item.id && (m.media_type === "photo" || m.type === "photo"))
      .map((m) => (m as any).signed_url || m.storage_path || m.file_path);

    if (itemPhotos.length > 0) {
      console.log(`[EDL Preview] Item ${item.item_name} has ${itemPhotos.length} photos. First URL: ${itemPhotos[0].substring(0, 50)}...`);
    }

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
    // 🔧 FIX: Capturer les photos globales de la pièce (item_id est nul)
    // On vérifie room_name OU section pour la compatibilité
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

  // ✅ SOTA 2026: Construire le bailleur avec fallbacks robustes
  const bailleur = {
    type: ownerProfile?.type || "particulier",
    nom_complet:
      ownerProfile?.type === "societe"
        ? ownerProfile?.raison_sociale || ""
        : `${ownerProfile?.profile?.prenom || ""} ${ownerProfile?.profile?.nom || ""}`.trim(),
    raison_sociale: ownerProfile?.raison_sociale,
    representant: (function() {
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
          s.role === 'owner' || s.role === 'proprietaire' || s.role === 'bailleur'
        );
        if (ownerSigner?.profile?.prenom) {
          return `${ownerSigner.profile.prenom} ${ownerSigner.profile.nom || ""}`.trim();
        }
        if (ownerSigner?.invited_name) return ownerSigner.invited_name;
      }
      
      // 4. Depuis les signatures EDL
      if (Array.isArray(signatures)) {
        const ownerSig = signatures.find((s: any) => 
          s.signer_role === 'owner' || s.signer_role === 'proprietaire'
        );
        if (ownerSig?.profile?.prenom) {
          return `${ownerSig.profile.prenom} ${ownerSig.profile.nom || ""}`.trim();
        }
      }
      
      // Debug si pas de représentant trouvé pour une société
      if (ownerProfile?.type === "societe") {
        console.warn("[mapDatabaseToEDLComplet] ⚠️ Société sans représentant:", ownerProfile?.raison_sociale);
      }
      
      return undefined;
    })(),
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

  console.log(`[mapDatabaseToEDLComplet] Mapped signatures for ${edl.id}:`, mappedSignatures.map((s: any) => ({
    type: s.signer_type,
    name: s.signer_name,
    hasImage: !!s.signature_image,
    imageUrl: s.signature_image ? (s.signature_image.startsWith('data:') ? 'base64' : s.signature_image.substring(0, 30) + '...') : 'none',
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



