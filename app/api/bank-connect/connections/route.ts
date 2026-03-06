export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/bank-connect/connections
 * Récupère les connexions bancaires de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: connections, error: dbError } = await serviceClient
      .from("bank_connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      // Table may not exist yet
      if (dbError.code === "42P01") {
        return NextResponse.json({ connections: [] });
      }
      throw dbError;
    }

    return NextResponse.json({ connections: connections || [] });
  } catch (error: unknown) {
    console.error("[GET /api/bank-connect/connections] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
