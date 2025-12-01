// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Génère un token encodé pour la signature
function generateSignatureToken(leaseId: string, tenantEmail: string): string {
  const timestamp = Date.now();
  const data = `${leaseId}:${tenantEmail}:${timestamp}`;
  return Buffer.from(data, "utf-8").toString("base64url");
}

export async function GET() {
  try {
    // Authentifier l'utilisateur
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Utiliser le service role pour contourner les RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ signatureLinks: [] });
    }

    // Récupérer les signers en attente
    const { data: pendingSigners, error: signersError } = await serviceClient
      .from("lease_signers")
      .select("lease_id")
      .eq("profile_id", profile.id)
      .eq("signature_status", "pending")
      .eq("role", "locataire_principal");

    if (signersError || !pendingSigners || pendingSigners.length === 0) {
      return NextResponse.json({ signatureLinks: [] });
    }

    // Récupérer les détails des baux en attente de signature
    const leaseIds = pendingSigners.map(s => s.lease_id);
    const { data: leases, error: leasesError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        type_bail,
        loyer,
        charges_forfaitaires,
        date_debut,
        property:properties (
          adresse_complete,
          code_postal,
          ville
        )
      `)
      .in("id", leaseIds)
      .eq("statut", "pending_signature");

    if (leasesError || !leases || leases.length === 0) {
      return NextResponse.json({ signatureLinks: [] });
    }

    // Générer les liens de signature
    const signatureLinks = leases.map((lease: any) => {
      const token = generateSignatureToken(lease.id, user.email || "");
      const property = lease.property;
      
      return {
        leaseId: lease.id,
        token,
        signatureUrl: `/signature/${token}`,
        type_bail: lease.type_bail,
        loyer: lease.loyer,
        charges: lease.charges_forfaitaires || 0,
        date_debut: lease.date_debut,
        propertyAddress: property 
          ? `${property.adresse_complete}, ${property.code_postal} ${property.ville}`
          : "Adresse non disponible",
      };
    });

    return NextResponse.json({ signatureLinks });
  } catch (error) {
    console.error("[signature-link] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}



