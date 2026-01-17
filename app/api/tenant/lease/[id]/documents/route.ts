import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;
    const serviceClient = getServiceClient();

    // 1. Vérifier que le locataire a accès à ce bail
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, property_id")
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // 2. Récupérer tous les documents liés au bail OU à la propriété
    const { data: docs, error: docsError } = await serviceClient
      .from("documents")
      .select("*")
      .or(`lease_id.eq.${leaseId},property_id.eq.${lease.property_id}`)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (docsError) {
      console.error("[Lease Documents] Error:", docsError);
      return NextResponse.json({ error: "Erreur lors de la récupération des documents" }, { status: 500 });
    }

    // 3. Catégoriser les documents
    const diagnosticsTypes = [
      "diagnostic_performance", "dpe", "crep", "plomb", 
      "electricite", "gaz", "erp", "risques", "amiante", "bruit"
    ];

    const results = {
      diagnostics: docs.filter(d => diagnosticsTypes.some(t => d.type?.toLowerCase().includes(t))),
      contractual: docs.filter(d => !diagnosticsTypes.some(t => d.type?.toLowerCase().includes(t)) && ["bail", "quittance", "assurance", "edl"].some(t => d.type?.toLowerCase().includes(t))),
      others: docs.filter(d => !diagnosticsTypes.some(t => d.type?.toLowerCase().includes(t)) && !["bail", "quittance", "assurance", "edl"].some(t => d.type?.toLowerCase().includes(t)))
    };

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error("[Lease Documents] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}


