/**
 * POST /api/leases/[id]/key-handover — Générer un token QR pour la remise des clés
 * GET  /api/leases/[id]/key-handover — Récupérer le statut de la remise des clés
 *
 * Sécurité : Seul le propriétaire du bail peut générer le QR.
 * Le token expire après 1 heure.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function generateHandoverToken(leaseId: string, expiresAt: string): string {
  const payload = JSON.stringify({ leaseId, expiresAt, nonce: randomUUID() });
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "talok-key-handover-secret";
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  // Token = base64(payload) + "." + hmac
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${hmac}`;
}

export function verifyHandoverToken(token: string): { leaseId: string; expiresAt: string } | null {
  try {
    const [b64, hmac] = token.split(".");
    if (!b64 || !hmac) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf-8");
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "talok-key-handover-secret";
    const expectedHmac = createHmac("sha256", secret).update(payload).digest("hex");
    if (hmac !== expectedHmac) return null;
    const data = JSON.parse(payload);
    if (new Date(data.expiresAt) < new Date()) return null;
    return { leaseId: data.leaseId, expiresAt: data.expiresAt };
  } catch {
    return null;
  }
}

/**
 * GET — Statut de la remise des clés pour ce bail
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Chercher une remise des clés existante
    const { data: handover } = await serviceClient
      .from("key_handovers")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      exists: !!handover,
      handover: handover || null,
      confirmed: handover?.confirmed_at ? true : false,
    });
  } catch (error: unknown) {
    console.error("[key-handover GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST — Générer un QR code token pour la remise des clés
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est propriétaire de ce bail
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Seul le propriétaire peut initier la remise des clés" }, { status: 403 });
    }

    // Vérifier que le bail existe et est en état approprié
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, statut, property_id, loyer_mensuel")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    if (!["fully_signed", "active"].includes(lease.statut)) {
      return NextResponse.json(
        { error: "Le bail doit être signé avant la remise des clés" },
        { status: 400 }
      );
    }

    // Récupérer les clés depuis le dernier EDL d'entrée
    const { data: edl } = await serviceClient
      .from("edl")
      .select("id, keys, status")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const keys = edl?.keys || [];

    // Récupérer l'adresse du bien
    const { data: property } = await serviceClient
      .from("properties")
      .select("adresse_complete, code_postal, ville")
      .eq("id", lease.property_id)
      .single();

    // Vérifier s'il y a déjà une remise non confirmée
    const { data: existingHandover } = await serviceClient
      .from("key_handovers")
      .select("id, token, expires_at, confirmed_at")
      .eq("lease_id", leaseId)
      .is("confirmed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si un token existe et n'est pas expiré, le réutiliser
    if (existingHandover && new Date(existingHandover.expires_at) > new Date()) {
      return NextResponse.json({
        token: existingHandover.token,
        expires_at: existingHandover.expires_at,
        keys,
        property_address: property?.adresse_complete || "",
        handover_id: existingHandover.id,
      });
    }

    // Générer un nouveau token (expire dans 1h)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const token = generateHandoverToken(leaseId, expiresAt);

    // Enregistrer en DB
    const { data: handover, error: insertError } = await serviceClient
      .from("key_handovers")
      .insert({
        lease_id: leaseId,
        property_id: lease.property_id,
        owner_profile_id: profile.id,
        token,
        keys_list: keys,
        expires_at: expiresAt,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("[key-handover POST] Insert error:", insertError);
      throw insertError;
    }

    return NextResponse.json({
      token,
      expires_at: expiresAt,
      keys,
      property_address: property?.adresse_complete || "",
      handover_id: handover.id,
    });
  } catch (error: unknown) {
    console.error("[key-handover POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
