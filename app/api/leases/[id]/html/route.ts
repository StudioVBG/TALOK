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
      .select("tenant_id, sealed_at, signed_pdf_path, property:properties(owner_id, ville)")
      .eq("id", leaseId)
      .single();

    if (!leaseCheck) return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });

    const isOwner = (leaseCheck.property as any)?.owner_id === profile.id;
    const isDirectTenant = (leaseCheck as any).tenant_id === profile.id;
    const { data: signerCheck } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    const isAdmin = profile.role === "admin";

    // Tenants whose bail was created without the e-signature flow are not
    // in `lease_signers` but are still referenced by `leases.tenant_id` —
    // allow them to read their own bail HTML via the direct FK.
    if (!isOwner && !signerCheck && !isDirectTenant && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé à ce bail" }, { status: 403 });
    }

    // Sealed bail — return stored PDF URL only if the file actually
    // exists in storage. createSignedUrl() happily signs a URL for a
    // missing object, which then renders as a blank iframe on the
    // client. List the parent folder and verify the filename is there
    // before committing to the sealed branch; otherwise fall through
    // to regenerating the HTML on the fly.
    if (
      leaseCheck.sealed_at &&
      leaseCheck.signed_pdf_path &&
      !leaseCheck.signed_pdf_path.startsWith("pending_generation_")
    ) {
      const signedPath = leaseCheck.signed_pdf_path as string;
      const lastSlash = signedPath.lastIndexOf("/");
      const folder = lastSlash >= 0 ? signedPath.slice(0, lastSlash) : "";
      const fileName = lastSlash >= 0 ? signedPath.slice(lastSlash + 1) : signedPath;

      const { data: files } = await serviceClient
        .storage
        .from("documents")
        .list(folder, { limit: 100, search: fileName });

      const hasNonEmptyFile = (files || []).some(
        (f: any) => f.name === fileName && (f.metadata?.size ?? 0) > 0
      );

      if (hasNonEmptyFile) {
        // Le "signed_pdf_path" est historiquement un chemin HTML
        // (bails/{id}/signed_final.html) — pas un PDF. On download le
        // contenu et on le renvoie tel quel pour injection via
        // <iframe srcDoc={html}> cote client (meme pattern que la vue
        // owner, qui ne passe pas par un iframe PDF).
        const { data: fileBlob, error: dlError } = await serviceClient.storage
          .from("documents")
          .download(signedPath);

        if (!dlError && fileBlob) {
          const htmlContent = await fileBlob.text();
          if (htmlContent && htmlContent.length > 0) {
            return NextResponse.json({
              sealed: true,
              sealedAt: leaseCheck.sealed_at,
              html: htmlContent,
              fileName: `Bail_Signe_${(leaseCheck.property as any)?.ville || "document"}.pdf`,
              pdfUrl: null,
            });
          }
        }

        console.warn(
          "[Lease HTML] sealed file download failed, falling back to HTML regeneration",
          { leaseId, signed_pdf_path: signedPath, error: dlError?.message }
        );
      } else {
        console.warn(
          "[Lease HTML] sealed_at set but signed_pdf_path missing in storage, falling back to HTML",
          { leaseId, signed_pdf_path: signedPath }
        );
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
