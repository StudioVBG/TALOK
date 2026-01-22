export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/properties/[id]/inspections - Planifier un EDL
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
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

    const body = await request.json();
    const { type, scheduled_at, lease_id, notes, keys } = body;

    if (!type || !["entree", "sortie"].includes(type)) {
      return NextResponse.json(
        { error: "Type requis: 'entree' ou 'sortie'" },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "Date de planification requise" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;
    if (propertyData.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // 🔧 FIX: Éviter les doublons d'EDL en brouillon/planifiés pour le même bail et même type
    if (lease_id) {
      const { data: existingEdl } = await supabase
        .from("edl")
        .select("*")
        .eq("lease_id", lease_id)
        .eq("type", type)
        .in("status", ["draft", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEdl) {
        console.log("[api/inspections] EDL existant trouvé pour ce bail, réutilisation de:", existingEdl.id);
        return NextResponse.json({ edl: existingEdl });
      }
    }

    // Créer l'EDL
    const { data: edl, error } = await supabase
      .from("edl")
      .insert({
        property_id: id,
        lease_id: lease_id || null,
        type,
        scheduled_at: scheduled_at,
        status: "scheduled",
        general_notes: notes,
        keys: keys || [],
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const edlData = edl as any;

    // 🔧 FIX: Injecter automatiquement les signataires du bail dans l'EDL
    if (lease_id) {
      const { data: leaseSigners } = await supabase
        .from("lease_signers")
        .select("profile_id, role")
        .eq("lease_id", lease_id);

      if (leaseSigners && leaseSigners.length > 0) {
        const edlSignatures = leaseSigners.map((ls: any) => ({
          edl_id: edlData.id,
          signer_user: null, // Sera rempli lors de la signature via auth.uid()
          signer_profile_id: ls.profile_id,
          // Convertir le rôle du bail vers le rôle EDL (supporte les formats FR et EN)
          signer_role: (ls.role === "proprietaire" || ls.role === "owner") ? "owner" : "tenant",
          invitation_token: crypto.randomUUID(),
        }));

        await supabase.from("edl_signatures").insert(edlSignatures);
        console.log(`[api/inspections] ${edlSignatures.length} signataires injectés depuis le bail`);
      }
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Inspection.Scheduled",
      payload: {
        edl_id: edlData.id,
        property_id: id as any,
        lease_id,
        type,
        scheduled_at,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_scheduled",
      entity_type: "edl",
      entity_id: edlData.id,
      metadata: { type, scheduled_at },
    } as any);

    return NextResponse.json({ edl: edlData });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





