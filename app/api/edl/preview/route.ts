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
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";

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
                }
              } else if (sig.signer_role === 'tenant' && sig.signed_at) {
                // 🔧 FALLBACK: Si la signature EDL est manquante mais que le locataire a signé le bail,
                // on cherche son image de signature dans le dossier du bail.
                const leaseId = (edl as any).lease_id;
                const userId = sig.signer_user;
                
                if (leaseId && userId) {
                  const { data: leaseFiles } = await adminClient.storage
                    .from("documents")
                    .list(`signatures/${leaseId}`);
                  
                  const tenantLeaseFile = leaseFiles?.find(f => f.name.startsWith(userId));
                  if (tenantLeaseFile) {
                    const fallbackPath = `signatures/${leaseId}/${tenantLeaseFile.name}`;
                    const { data: signedUrlData } = await adminClient.storage
                      .from("documents")
                      .createSignedUrl(fallbackPath, 3600);
                    
                    if (signedUrlData?.signedUrl) {
                      (sig as any).signature_image_url = signedUrlData.signedUrl;
                    }
                  }
                }
              }
            }
          }

          // Résoudre l'identité du propriétaire via le résolveur centralisé (entity-first + fallback)
          const propertyOwnerId = (edl as any).lease?.property?.owner_id;
          const ownerIdentity = await resolveOwnerIdentity(adminClient, {
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


          // 🔧 FIX: Récupérer tous les compteurs du bien pour les inclure dans l'aperçu même sans relevé
          const propertyId = (edl as any).property_id || (edl as any).lease?.property_id || (edl as any).lease?.property?.id;

          let allMeters: any[] = [];
          if (propertyId) {
            const { data: meters } = await adminClient
              .from("meters")
              .select("*")
              .eq("property_id", propertyId);

            // Filtrer en JS pour éviter l'erreur si la colonne is_active n'existe pas
            allMeters = meters?.filter(m => m.is_active !== false) || [];
          }

          // 🔧 FIX AMÉLIORÉ: Mapper les relevés existants avec URLs signées
          // Les compteurs des relevés sont la source de vérité pour les valeurs
          const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));


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


