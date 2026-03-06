export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ entityId: string }>;
}

/**
 * GET /api/owner/legal-entities/[entityId]/documents
 * Liste les documents rattachés à une entité juridique
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { entityId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Vérifier que l'entité appartient au propriétaire
    const { data: entity } = await supabase
      .from("legal_entities")
      .select("owner_profile_id")
      .eq("id", entityId)
      .single();

    if (!entity || entity.owner_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Entité non trouvée" },
        { status: 404 }
      );
    }

    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, type, nom, created_at, property_id, lease_id, url")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ documents: [] });
      }
      throw error;
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error: unknown) {
    console.error("[GET /api/owner/legal-entities/[entityId]/documents]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
