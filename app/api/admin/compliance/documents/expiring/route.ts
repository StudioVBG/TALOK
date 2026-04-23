export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireAdminPermissions,
  isAdminAuthError,
} from "@/lib/middleware/admin-rbac";

/**
 * GET /api/admin/compliance/documents/expiring
 * Liste les documents de compliance vérifiés qui expirent dans les 30 prochains jours
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminPermissions(
      request,
      ["admin.compliance.read"],
      { rateLimit: "adminStandard", auditAction: "Consultation des documents conformité expirants" }
    );
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const { data: documents, error } = await supabase
      .from("provider_compliance_documents")
      .select(
        `
        id,
        document_type,
        expiration_date,
        provider_profile_id,
        provider:profiles!provider_compliance_documents_provider_profile_id_fkey (
          id,
          prenom,
          nom,
          telephone
        )
      `
      )
      .eq("verification_status", "verified")
      .not("expiration_date", "is", null)
      .gte("expiration_date", now.toISOString().split("T")[0])
      .lte("expiration_date", futureDate.toISOString().split("T")[0])
      .order("expiration_date", { ascending: true });

    if (error) {
      console.error("Error fetching expiring documents:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedDocs = (documents || []).map((doc: Record<string, unknown>) => {
      const provider = doc.provider as Record<string, unknown> | null;
      const expirationDate = new Date(doc.expiration_date as string);
      const diffTime = expirationDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        document_id: doc.id,
        document_type: doc.document_type,
        expiration_date: doc.expiration_date,
        days_until_expiry: daysUntilExpiry,
        provider_profile_id: doc.provider_profile_id,
        provider_name: provider
          ? `${provider.prenom || ""} ${provider.nom || ""}`.trim() || "Inconnu"
          : "Inconnu",
      };
    });

    return NextResponse.json({ documents: formattedDocs });
  } catch (error: unknown) {
    console.error(
      "Error in GET /api/admin/compliance/documents/expiring:",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
