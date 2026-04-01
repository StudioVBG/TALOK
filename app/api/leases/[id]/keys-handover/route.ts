/**
 * GET    /api/leases/[id]/keys-handover — Récupérer la liste des clés + statut
 * PATCH  /api/leases/[id]/keys-handover — Mettre à jour la liste de clés avant remise
 * DELETE /api/leases/[id]/keys-handover — Annuler une remise en attente
 *
 * Complément de /api/leases/[id]/key-handover (QR token + confirmation).
 * Permet au propriétaire de gérer la liste des clés avant de générer le QR.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface KeyItem {
  type: string;
  label?: string;
  quantite?: number;
  quantity?: number;
  observations?: string;
}

/**
 * Vérifie que l'utilisateur est propriétaire du bail.
 * Retourne { profile, lease } ou une Response d'erreur.
 */
async function authorizeOwner(leaseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Seul le propriétaire peut gérer la remise des clés" },
        { status: 403 }
      ),
    };
  }

  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, statut, property_id, properties!leases_property_id_fkey(owner_id)")
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return { error: NextResponse.json({ error: "Bail introuvable" }, { status: 404 }) };
  }

  if ((lease as any).properties?.owner_id !== profile.id) {
    return { error: NextResponse.json({ error: "Ce bail ne vous appartient pas" }, { status: 403 }) };
  }

  return { profile, lease, serviceClient };
}

/**
 * GET — Récupère la liste des clés de l'EDL d'entrée et l'état de la remise
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const auth = await authorizeOwner(leaseId);
    if ("error" in auth) return auth.error;

    const { serviceClient, lease } = auth;

    // Chercher l'EDL d'entrée pour les clés
    const { data: edl } = await (serviceClient.from("edl") as any)
      .select("id, keys, status")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Chercher la dernière remise des clés
    const { data: handover } = await (serviceClient.from("key_handovers") as any)
      .select("id, keys_list, confirmed_at, expires_at, cancelled_at, notes, created_at")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      lease_id: leaseId,
      lease_statut: (lease as any).statut,
      edl_signed: edl?.status === "signed",
      keys_from_edl: Array.isArray(edl?.keys) ? edl.keys : [],
      handover: handover
        ? {
            id: handover.id,
            keys_list: handover.keys_list || [],
            confirmed: !!handover.confirmed_at,
            confirmed_at: handover.confirmed_at || null,
            pending: !handover.confirmed_at && !handover.cancelled_at && new Date(handover.expires_at) > new Date(),
            cancelled: !!handover.cancelled_at,
            expires_at: handover.expires_at,
            notes: handover.notes || null,
            created_at: handover.created_at,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("[keys-handover GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Met à jour la liste de clés d'une remise en attente (ou crée un enregistrement préparatoire)
 * Body : { keys: KeyItem[], notes?: string }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const auth = await authorizeOwner(leaseId);
    if ("error" in auth) return auth.error;

    const { serviceClient, profile } = auth;

    const body = await request.json();
    const { keys, notes } = body as { keys?: KeyItem[]; notes?: string };

    if (!Array.isArray(keys)) {
      return NextResponse.json({ error: "Le champ 'keys' (tableau) est requis" }, { status: 400 });
    }

    // Valider la structure des clés
    for (const key of keys) {
      if (typeof key.type !== "string" || !key.type.trim()) {
        return NextResponse.json(
          { error: "Chaque clé doit avoir un champ 'type' (string)" },
          { status: 400 }
        );
      }
    }

    // Chercher une remise en attente non confirmée et non annulée
    const { data: existingHandover } = await (serviceClient.from("key_handovers") as any)
      .select("id, confirmed_at, cancelled_at")
      .eq("lease_id", leaseId)
      .is("confirmed_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingHandover) {
      // Mettre à jour la liste de clés
      await (serviceClient.from("key_handovers") as any)
        .update({
          keys_list: keys,
          ...(notes !== undefined ? { notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingHandover.id);

      return NextResponse.json({
        updated: true,
        handover_id: existingHandover.id,
        keys_count: keys.length,
      });
    }

    // Aucune remise en attente : créer un brouillon (sans token)
    const { data: lease } = await serviceClient
      .from("leases")
      .select("property_id")
      .eq("id", leaseId)
      .single();

    const { data: newHandover, error: insertError } = await (serviceClient.from("key_handovers") as any)
      .insert({
        lease_id: leaseId,
        property_id: lease?.property_id,
        owner_profile_id: (profile as any).id,
        keys_list: keys,
        notes: notes || null,
        // Pas de token ni expires_at — c'est un brouillon avant génération QR
        token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h par défaut
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      created: true,
      handover_id: (newHandover as any).id,
      keys_count: keys.length,
    });
  } catch (error: unknown) {
    console.error("[keys-handover PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Annule une remise des clés en attente (non confirmée)
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const auth = await authorizeOwner(leaseId);
    if ("error" in auth) return auth.error;

    const { serviceClient } = auth;

    const { data: handover } = await (serviceClient.from("key_handovers") as any)
      .select("id, confirmed_at")
      .eq("lease_id", leaseId)
      .is("confirmed_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!handover) {
      return NextResponse.json({ error: "Aucune remise en attente à annuler" }, { status: 404 });
    }

    await (serviceClient.from("key_handovers") as any)
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", handover.id);

    return NextResponse.json({ cancelled: true, handover_id: handover.id });
  } catch (error: unknown) {
    console.error("[keys-handover DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
