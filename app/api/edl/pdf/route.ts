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
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import { verifyEDLAccess } from "@/lib/helpers/edl-auth";
import { getServiceClient } from "@/lib/supabase/service-client";

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

    // Vérifier les permissions d'accès à l'EDL
    if (edlId) {
      const serviceClient = getServiceClient();
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }

      const accessResult = await verifyEDLAccess(
        { edlId, userId: user.id, profileId: profile.id, profileRole: profile.role },
        serviceClient
      );

      if (!accessResult.authorized) {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à cet état des lieux" },
          { status: 403 }
        );
      }
    }

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
          const ownerIdentity = await resolveOwnerIdentity(adminClient, {
            leaseId: (edl as any).lease_id,
            propertyId: (edl as any).property_id || (edl as any).lease?.property?.id,
            profileId: propertyOwnerId,
          });
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

          // 🔧 FIX AMÉLIORÉ: Mapper les relevés existants avec URLs signées
          // Les compteurs des relevés sont la source de vérité pour les valeurs
          const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));

          console.log(`[EDL PDF] Recorded meter IDs: ${Array.from(recordedMeterIds).join(', ')}`);

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
                console.log(`[EDL PDF] ✅ Signed meter photo URL: ${r.photo_path}`);
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

            console.log(`[EDL PDF] Checking meter ${m.id} (${m.type}): recorded=${alreadyRecordedById}`);

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

