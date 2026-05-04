/**
 * API Route: Supprime une passkey
 * DELETE /api/auth/passkeys/[id]
 *
 * Le parametre [id] correspond au UUID interne de passkey_credentials.id
 * (et non au credential_id WebAuthn). C'est ce que renvoie /api/auth/2fa/status
 * et ce que la UI passe au bouton supprimer.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant de passkey manquant" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // RLS garantit que l'utilisateur ne peut supprimer que ses propres passkeys
    const { error: deleteError, count } = await supabase
      .from("passkey_credentials")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[Passkeys] Erreur suppression:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    if (!count) {
      return NextResponse.json(
        { error: "Passkey introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur suppression:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
