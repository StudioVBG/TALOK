export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { buildBailData } from "@/lib/builders/bail-data.builder";

/**
 * GET /api/leases/[id]/html — HTML d'un bail (signe ou non)
 * SOTA 2026: Utilise buildBailData() comme unique source de donnees
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const serviceClient = getServiceClient();

    // Access check
    const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

    const { data: leaseCheck } = await serviceClient
      .from("leases")
      .select("sealed_at, signed_pdf_path, property:properties(owner_id, ville)")
      .eq("id", leaseId)
      .single();

    if (!leaseCheck) return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });

    const isOwner = (leaseCheck.property as any)?.owner_id === profile.id;
    const { data: signerCheck } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    const isAdmin = profile.role === "admin";

    if (!isOwner && !signerCheck && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé à ce bail" }, { status: 403 });
    }

    // Sealed bail — return stored PDF URL
    if (leaseCheck.sealed_at && leaseCheck.signed_pdf_path && !leaseCheck.signed_pdf_path.startsWith("pending_generation_")) {
      const { data: signedUrl } = await serviceClient.storage.from("documents").createSignedUrl(leaseCheck.signed_pdf_path, 3600);
      if (signedUrl?.signedUrl) {
        return NextResponse.json({
          sealed: true,
          pdfUrl: signedUrl.signedUrl,
          fileName: `Bail_Signe_${(leaseCheck.property as any)?.ville || "document"}.pdf`,
          html: null,
        });
      }
    }

    // Build bail data via unified builder
    const { bailData, typeBail, property } = await buildBailData(serviceClient, leaseId, {
      includeSignatures: true,
      includeDiagnostics: true,
    });

    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    return NextResponse.json({
      html,
      fileName: `Bail_${typeBail}_${property?.ville || "document"}.pdf`,
    });
  } catch (error: unknown) {
    console.error("[Lease HTML] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
