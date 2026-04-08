export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withSecurity } from "@/lib/api/with-security";

/**
 * DELETE /api/bank-connect/connections/[id]
 * Supprime une connexion bancaire
 */
export const DELETE = withSecurity(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier que la connexion appartient à l'utilisateur
    const { data: connection } = await (serviceClient as any)
      .from("bank_connections")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!connection || connection.user_id !== user.id) {
      return NextResponse.json(
        { error: "Connexion non trouvée" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await (serviceClient as any)
      .from("bank_connections")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/bank-connect/connections] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "DELETE /api/bank-connect/connections/[id]", csrf: true });
