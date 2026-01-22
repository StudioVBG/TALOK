export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { LeaseTemplateService } from "@/lib/templates/bail/template.service";
import { mapLeaseToTemplate } from "@/lib/mappers/lease-to-template";

/**
 * POST /api/leases/[id]/seal
 *
 * Scelle un bail après signature complète :
 * 1. Vérifie que toutes les signatures sont présentes
 * 2. Génère le PDF final avec les signatures
 * 3. Stocke le PDF dans Supabase Storage
 * 4. Met à jour le bail avec le chemin du PDF et la date de scellement
 * 5. Crée l'entrée document associée
 *
 * Un bail scellé ne peut plus être modifié (contenu contractuel).
 * Seul le statut peut évoluer (fully_signed → active → terminated).
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    const serviceClient = getServiceClient();
    
    // 1. Récupérer le bail complet avec toutes les relations
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties!leases_property_id_fkey(
          *,
          owner:profiles!properties_owner_id_fkey(*)
        ),
        signers:lease_signers(
          *,
          profile:profiles(*)
        )
      `)
      .eq("id", leaseId)
      .single();
    
    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }
    
    // 2. Vérifier que le bail n'est pas déjà scellé
    if ((lease as any).sealed_at) {
      return NextResponse.json({ 
        error: "Ce bail est déjà scellé",
        signed_pdf_path: (lease as any).signed_pdf_path 
      }, { status: 400 });
    }
    
    // 3. Vérifier que toutes les signatures sont présentes
    const signers = (lease as any).signers || [];
    const allSigned = signers.length > 0 && 
      signers.every((s: any) => s.signature_status === "signed");
    
    if (!allSigned) {
      const pendingSigners = signers
        .filter((s: any) => s.signature_status !== "signed")
        .map((s: any) => s.role);
      
      return NextResponse.json({ 
        error: "Toutes les signatures ne sont pas collectées",
        pending_signers: pendingSigners
      }, { status: 400 });
    }
    
    // 4. Récupérer le profil propriétaire complet
    const propertyOwnerId = (lease as any).property?.owner_id;
    const { data: ownerProfile } = await serviceClient
      .from("owner_profiles")
      .select("*, profile:profiles(*)")
      .eq("profile_id", propertyOwnerId)
      .single();
    
    // 5. Mapper les données pour le template
    const leaseDetails = {
      lease: lease as any,
      property: (lease as any).property,
      signers: signers,
      payments: [],
      documents: [],
    };
    
    const bailData = mapLeaseToTemplate(leaseDetails, {
      id: ownerProfile?.profile_id || propertyOwnerId,
      prenom: (ownerProfile as any)?.profile?.prenom || "",
      nom: (ownerProfile as any)?.profile?.nom || "",
      email: (ownerProfile as any)?.profile?.email || "",
      telephone: (ownerProfile as any)?.profile?.telephone || "",
      type: ownerProfile?.type || "particulier",
      raison_sociale: ownerProfile?.raison_sociale || "",
      forme_juridique: ownerProfile?.forme_juridique || "",
      siret: ownerProfile?.siret || "",
    });
    
    // 6. Générer le HTML final
    const html = LeaseTemplateService.generateHTML((lease as any).type_bail || "nu", bailData);
    
    // 7. Convertir en PDF (utiliser notre service existant ou API externe)
    // Pour l'instant, on stocke le HTML qui pourra être converti en PDF côté client
    const timestamp = Date.now();
    const fileName = `bail_signe_${leaseId}_${timestamp}.html`;
    const storagePath = `leases/${leaseId}/${fileName}`;
    
    // Créer le contenu HTML complet avec styles pour impression
    const fullHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bail de Location - Document Signé</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }
    .sealed-badge {
      position: fixed;
      top: 10mm;
      right: 10mm;
      background: #059669;
      color: white;
      padding: 5px 15px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: bold;
    }
    @media print {
      .sealed-badge { position: absolute; }
    }
  </style>
</head>
<body>
  <div class="sealed-badge">✓ DOCUMENT SIGNÉ</div>
  ${html}
  <footer style="margin-top: 30mm; padding-top: 10mm; border-top: 1px solid #ccc; font-size: 9pt; color: #666;">
    <p>Document scellé le ${new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
    <p>Référence : ${leaseId.substring(0, 8).toUpperCase()}</p>
  </footer>
</body>
</html>`;
    
    // 8. Uploader vers Supabase Storage
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, fullHtml, {
        contentType: "text/html",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[Seal] Erreur upload:", uploadError);
      return NextResponse.json({ 
        error: "Erreur lors du stockage du document",
        details: uploadError.message 
      }, { status: 500 });
    }
    
    // 9. Mettre à jour le bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        signed_pdf_path: storagePath,
        sealed_at: new Date().toISOString(),
        statut: "fully_signed",
      })
      .eq("id", leaseId);
    
    if (updateError) {
      console.error("[Seal] Erreur mise à jour bail:", updateError);
      // Essayer de supprimer le fichier uploadé
      await serviceClient.storage.from("documents").remove([storagePath]);
      
      return NextResponse.json({ 
        error: "Erreur lors de la mise à jour du bail",
        details: updateError.message 
      }, { status: 500 });
    }
    
    // 10. Créer l'entrée document
    await serviceClient.from("documents").insert({
      type: "bail",
      lease_id: leaseId,
      property_id: (lease as any).property_id,
      owner_id: propertyOwnerId,
      storage_path: storagePath,
      title: "Bail de location signé",
      metadata: {
        final: true,
        sealed_at: new Date().toISOString(),
        signers: signers.map((s: any) => ({
          role: s.role,
          name: `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim(),
          signed_at: s.signed_at,
        })),
      },
    });
    
    // 11. Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "lease.sealed",
      payload: {
        lease_id: leaseId,
        sealed_by: user.id,
        storage_path: storagePath,
      },
    });
    
    // 12. Audit
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "seal_lease",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        storage_path: storagePath,
        signers_count: signers.length,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: "Bail scellé avec succès",
      signed_pdf_path: storagePath,
      sealed_at: new Date().toISOString(),
    });
    
  } catch (error: unknown) {
    console.error("[Seal] Erreur:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Erreur serveur" 
    }, { status: 500 });
  }
}

/**
 * GET /api/leases/[id]/seal
 * Vérifie si un bail est scellé et retourne ses informations
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    const serviceClient = getServiceClient();
    
    const { data: lease, error } = await serviceClient
      .from("leases")
      .select("id, statut, signed_pdf_path, sealed_at")
      .eq("id", leaseId)
      .single();
    
    if (error || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }
    
    const isSealed = !!(lease as any).sealed_at;
    
    return NextResponse.json({
      is_sealed: isSealed,
      sealed_at: (lease as any).sealed_at,
      signed_pdf_path: (lease as any).signed_pdf_path,
      statut: lease.statut,
      is_editable: !isSealed && ["draft", "sent", "pending_signature"].includes(lease.statut || ""),
    });
    
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}




