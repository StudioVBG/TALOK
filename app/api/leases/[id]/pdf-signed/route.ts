export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leases/[id]/pdf-signed
 *
 * Génère et retourne le document HTML complet du bail signé (téléchargement à la demande).
 * Le HTML inclut signatures, certificat et styles d'impression A4.
 * La logique de génération est centralisée dans lib/services/lease-pdf-generator.ts
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateSignedLeasePDF } from "@/lib/services/lease-pdf-generator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json({ error: "ID du bail requis" }, { status: 400 });
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const serviceClient = getServiceClient();
    const { data: lease } = await serviceClient
      .from("leases")
      .select(
        `id, property:properties(id, owner_id), signers:lease_signers(profile_id)`
      )
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    const isSigner = (lease.signers as any[])?.some(
      (s: any) => s.profile_id === profile.id
    );

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    const { html, fileName } = await generateSignedLeasePDF(leaseId);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(Buffer.byteLength(html, "utf-8")),
      },
    });
  } catch (error: unknown) {
    console.error("Erreur génération document signé:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
