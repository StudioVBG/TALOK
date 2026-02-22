export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/invoices/[id]/receipt - Télécharger la quittance PDF liée à une facture
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const invoiceId = id;

    // 1. Trouver le document de type "quittance" lié à cette facture
    let document: any = null;
    const { data: firstDoc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("type", "quittance")
      .filter("metadata->>invoice_id", "eq", invoiceId)
      .single();

    if (docError || !firstDoc) {
      // Si pas trouvé par metadata, chercher par nom ou autre
      const { data: fallbackDoc } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "quittance")
        .eq("metadata->invoice_id", invoiceId) // Alternative query syntax
        .maybeSingle();
        
      if (!fallbackDoc) {
        return NextResponse.json(
          { error: "Quittance non trouvée pour cette facture" },
          { status: 404 }
        );
      }
      document = fallbackDoc;
    } else {
      document = firstDoc;
    }

    // 2. Vérifier que l'utilisateur a accès à cette quittance
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const isOwner = document.owner_id === profile.id;
    const isTenant = document.tenant_id === profile.id;
    let hasAccessViaLease = false;
    if (document.lease_id && !isOwner && !isTenant) {
      const { data: signer } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", document.lease_id)
        .eq("profile_id", profile.id)
        .maybeSingle();
      hasAccessViaLease = !!signer;
    }

    if (!isOwner && !isTenant && !hasAccessViaLease) {
      return NextResponse.json({ error: "Accès non autorisé à cette quittance" }, { status: 403 });
    }

    // 3. Récupérer le fichier depuis le storage
    const { data, error: storageError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);

    if (storageError || !data) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération du fichier PDF" },
        { status: 500 }
      );
    }

    // 4. Retourner le PDF
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.name || 'quittance'}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Receipt Download] Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

