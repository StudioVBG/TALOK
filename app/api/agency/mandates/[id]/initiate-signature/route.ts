export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendSignatureRequest } from "@/lib/emails/resend.service";

/**
 * POST /api/agency/mandates/[id]/initiate-signature
 *
 * L'agence envoie le mandat à son client mandant pour signature.
 * - Génère un token unique
 * - Marque signature_status='pending'
 * - Envoie un email (lien tokenisé) au mandant via Resend
 * - Insère un événement Agency.MandateSentForSignature dans outbox
 *
 * Le mandat doit être en statut 'draft' pour pouvoir être envoyé.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Auth + RBAC
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "agency" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Réservé aux agences" }, { status: 403 });
    }

    // 2. Récupérer mandat + mandant (service role pour bypass RLS sur owner profile)
    const serviceClient = getServiceClient();
    const { data: mandate, error: mandateError } = await serviceClient
      .from("agency_mandates")
      .select(
        `
        id, mandate_number, status, signature_status,
        owner_profile_id, agency_profile_id, mandate_type,
        owner:profiles!agency_mandates_owner_profile_id_fkey(
          id, prenom, nom, email
        )
      `,
      )
      .eq("id", id)
      .eq("agency_profile_id", profile.id)
      .maybeSingle();

    if (mandateError || !mandate) {
      return NextResponse.json({ error: "Mandat introuvable" }, { status: 404 });
    }

    if (mandate.status !== "draft") {
      return NextResponse.json(
        { error: "Seuls les mandats en brouillon peuvent être envoyés à la signature" },
        { status: 400 },
      );
    }

    if (mandate.signature_status === "pending") {
      return NextResponse.json(
        { error: "Une signature est déjà en cours pour ce mandat" },
        { status: 409 },
      );
    }

    const owner = (mandate as any).owner as
      | { id: string; prenom: string; nom: string; email: string }
      | null;
    if (!owner?.email) {
      return NextResponse.json(
        { error: "Le propriétaire mandant n'a pas d'email enregistré" },
        { status: 400 },
      );
    }

    // 3. Token unique
    const signatureToken = crypto.randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    const { error: updateError } = await serviceClient
      .from("agency_mandates")
      .update({
        signature_status: "pending",
        signature_token: signatureToken,
        signature_sent_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: `Erreur DB: ${updateError.message}` },
        { status: 500 },
      );
    }

    // 4. Email mandant (Resend, idempotent par token)
    const ownerName = `${owner.prenom ?? ""} ${owner.nom ?? ""}`.trim() || "Mandant";
    const agencyName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Votre agence";

    await sendSignatureRequest({
      signerEmail: owner.email,
      signerName: ownerName,
      ownerName: agencyName,
      propertyAddress: `Mandat ${mandate.mandate_number}`,
      leaseType: `Mandat de ${mandate.mandate_type}`,
      signatureToken,
    }).catch((err) => {
      console.error("[mandate.initiate-signature] Email failed:", err);
    });

    // 5. Outbox event (event sourcing fan-out)
    await serviceClient
      .from("outbox")
      .insert({
        event_type: "Agency.MandateSentForSignature",
        payload: {
          mandate_id: id,
          mandate_number: mandate.mandate_number,
          owner_profile_id: mandate.owner_profile_id,
          agency_profile_id: mandate.agency_profile_id,
        },
      })
      .then(({ error }) => {
        if (error) console.error("[mandate.initiate-signature] Outbox failed:", error);
      });

    return NextResponse.json({
      success: true,
      mandate_id: id,
      signature_status: "pending",
      signature_url: `${process.env.NEXT_PUBLIC_APP_URL}/signature/${signatureToken}`,
    });
  } catch (error) {
    console.error("[mandate.initiate-signature] Unexpected:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
