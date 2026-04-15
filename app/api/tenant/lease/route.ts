export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // FIX P1-E2b: Vérifier que l'utilisateur est bien un locataire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("[GET /api/tenant/lease] Profile lookup error:", profileError);
      // Ne pas faire tomber la page avec un 500 : on remonte un 404 propre.
      // Le client tenant gère déjà "pas de bail" comme un état non-erreur.
      return NextResponse.json(
        { lease: null, property: null },
        { status: 404 }
      );
    }

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json(
        { error: "Accès réservé aux locataires" },
        { status: 403 }
      );
    }

    // Utiliser la RPC dashboard pour récupérer les infos de bail de manière cohérente
    const { data, error } = await supabase.rpc("tenant_dashboard", {
      p_tenant_user_id: user.id,
    });

    if (error) {
      console.error("[GET /api/tenant/lease] RPC error:", {
        code: (error as { code?: string }).code,
        message: error.message,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      });
      // Erreur RPC côté DB (ex. fonction manquante ou bug plpgsql) :
      // on renvoie 500 avec un message sobre, sans fuiter l'erreur brute.
      return NextResponse.json(
        { error: "Erreur serveur lors de la récupération du bail" },
        { status: 500 }
      );
    }

    const payload = (data as { lease?: unknown; property?: unknown } | null) ?? null;
    const lease = payload?.lease ?? null;
    const property = payload?.property ?? null;

    // Pas de bail actif : 404 propre plutôt qu'un 500. Les clients tenant
    // qui pollent cette route doivent pouvoir distinguer "pas encore de
    // bail" (état normal) d'une vraie panne serveur.
    if (!lease) {
      return NextResponse.json(
        { lease: null, property: null },
        { status: 404 }
      );
    }

    return NextResponse.json({ lease, property });
  } catch (err) {
    console.error("[GET /api/tenant/lease] Unexpected error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

