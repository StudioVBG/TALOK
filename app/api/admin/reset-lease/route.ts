export const runtime = 'nodejs';

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/reset-lease
 * Réinitialise un bail pour permettre une nouvelle signature
 * Body: { lease_id: string, reset_edl?: boolean, reset_invoices?: boolean }
 */
export async function POST(request: Request) {
  try {
    // Vérifier authentification
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin ou propriétaire du bail
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const body = await request.json();
    const { lease_id, reset_edl = false, reset_invoices = false } = body;

    if (!lease_id) {
      return NextResponse.json({ error: "lease_id requis" }, { status: 400 });
    }

    // Client admin pour bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Vérifier que le bail existe et appartient à l'utilisateur (ou admin)
    const { data: lease, error: leaseError } = await adminClient
      .from("leases")
      .select(`
        id,
        statut,
        property_id,
        properties (
          owner_id
        )
      `)
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Vérifier les droits
    const isAdmin = profile?.role === "admin";
    const isOwner = (lease.properties as any)?.owner_id === profile?.id;
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const results: any = {
      lease_id,
      actions: [],
    };

    // 1. Réinitialiser les signatures
    const { data: signers, error: signersError } = await adminClient
      .from("lease_signers")
      .select("id, role, signature_status")
      .eq("lease_id", lease_id);

    if (signers && signers.length > 0) {
      const { error: resetSignersError } = await adminClient
        .from("lease_signers")
        .update({
          signature_status: "pending",
          signed_at: null,
          signature_image: null,
          signature_image_path: null,
          proof_id: null,
          proof_metadata: null,
          document_hash: null,
          ip_inet: null,
          user_agent: null,
        })
        .eq("lease_id", lease_id);

      if (resetSignersError) {
        results.actions.push({ type: "reset_signers", status: "error", error: resetSignersError.message });
      } else {
        results.actions.push({ type: "reset_signers", status: "success", count: signers.length });
      }
    }

    // 2. Mettre à jour le statut du bail
    const { error: updateLeaseError } = await adminClient
      .from("leases")
      .update({ 
        statut: "pending_signature",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lease_id);

    if (updateLeaseError) {
      results.actions.push({ type: "update_lease_status", status: "error", error: updateLeaseError.message });
    } else {
      results.actions.push({ type: "update_lease_status", status: "success", new_status: "pending_signature" });
    }

    // 3. Réinitialiser l'EDL si demandé
    if (reset_edl) {
      // Supprimer les signatures EDL
      const { error: deleteEdlSigsError } = await adminClient
        .from("edl_signatures")
        .delete()
        .eq("edl_id", await adminClient
          .from("edl")
          .select("id")
          .eq("lease_id", lease_id)
          .then(r => r.data?.[0]?.id || "00000000-0000-0000-0000-000000000000")
        );

      // Mettre l'EDL en draft
      const { error: resetEdlError } = await adminClient
        .from("edl")
        .update({ 
          status: "draft",
          completed_date: null,
        })
        .eq("lease_id", lease_id);

      results.actions.push({ 
        type: "reset_edl", 
        status: resetEdlError ? "error" : "success",
        error: resetEdlError?.message 
      });
    }

    // 4. Supprimer les factures non payées si demandé
    if (reset_invoices) {
      const { error: deleteInvoicesError } = await adminClient
        .from("invoices")
        .delete()
        .eq("lease_id", lease_id)
        .in("statut", ["draft", "sent", "late"]);

      results.actions.push({ 
        type: "delete_unpaid_invoices", 
        status: deleteInvoicesError ? "error" : "success",
        error: deleteInvoicesError?.message 
      });
    }

    // 5. Générer de nouveaux tokens d'invitation pour les signataires
    const { data: updatedSigners } = await adminClient
      .from("lease_signers")
      .select("id, role, invited_email, invited_name, profile_id")
      .eq("lease_id", lease_id);

    const invitationLinks: any[] = [];
    
    for (const signer of updatedSigners || []) {
      if (signer.invited_email) {
        // Générer un nouveau token
        const tokenData = `${lease_id}:${signer.invited_email}:${Date.now()}`;
        const token = Buffer.from(tokenData).toString("base64url");
        const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signature/${token}`;
        
        invitationLinks.push({
          role: signer.role,
          email: signer.invited_email,
          name: signer.invited_name,
          url: invitationUrl,
          token,
        });
      }
    }

    results.invitation_links = invitationLinks;

    // 6. Log l'action
    console.log(`[Reset Lease] Bail ${lease_id} réinitialisé par ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Bail réinitialisé avec succès",
      results,
    });

  } catch (error: unknown) {
    console.error("[Reset Lease] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * GET /api/admin/reset-lease?lease_id=xxx
 * Diagnostic: affiche l'état actuel du bail et de ses dépendances
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lease_id = searchParams.get("lease_id");

    if (!lease_id) {
      return NextResponse.json({ error: "lease_id requis" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Récupérer toutes les données du bail
    const [
      { data: lease },
      { data: signers },
      { data: edl },
      { data: invoices },
      { data: payments },
    ] = await Promise.all([
      adminClient.from("leases").select("*").eq("id", lease_id).single(),
      adminClient.from("lease_signers").select("*").eq("lease_id", lease_id),
      adminClient.from("edl").select("*, edl_signatures(*)").eq("lease_id", lease_id),
      adminClient.from("invoices").select("*").eq("lease_id", lease_id).order("created_at", { ascending: false }).limit(5),
      adminClient.from("payments").select("*, invoices(periode)").eq("invoices.lease_id", lease_id).limit(5),
    ]);

    // Analyser l'état
    const diagnostic = {
      lease: {
        id: lease?.id,
        statut: lease?.statut,
        type_bail: lease?.type_bail,
        date_debut: lease?.date_debut,
        loyer: lease?.loyer,
        charges: lease?.charges_forfaitaires,
      },
      signers: (signers || []).map((s: any) => ({
        id: s.id,
        role: s.role,
        email: s.invited_email,
        name: s.invited_name,
        status: s.signature_status,
        signed_at: s.signed_at,
        has_image: !!s.signature_image || !!s.signature_image_path,
        has_path: !!s.signature_image_path,
      })),
      edl: (edl || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        status: e.status,
        signatures_count: e.edl_signatures?.length || 0,
        signatures: (e.edl_signatures || []).map((sig: any) => ({
          role: sig.signer_role,
          signed: !!sig.signed_at,
        })),
      })),
      invoices: (invoices || []).map((i: any) => ({
        id: i.id,
        periode: i.periode,
        montant: i.montant_total,
        statut: i.statut,
      })),
      flow_status: {
        signatures_complete: (signers || []).every((s: any) => s.signature_status === "signed"),
        edl_complete: (edl || []).some((e: any) => e.type === "entree" && e.status === "signed"),
        can_activate: false,
        has_initial_invoice: (invoices || []).some((i: any) => i.periode?.includes("initial") || i.type === "depot"),
      },
    };

    // Déterminer si le bail peut être activé
    diagnostic.flow_status.can_activate = 
      diagnostic.flow_status.signatures_complete && 
      diagnostic.flow_status.edl_complete;

    return NextResponse.json({
      success: true,
      diagnostic,
    });

  } catch (error: unknown) {
    console.error("[Reset Lease GET] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

