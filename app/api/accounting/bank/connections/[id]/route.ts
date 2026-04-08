/**
 * API Route: Bank Connection Detail
 * GET /api/accounting/bank/connections/:id - Single connection details
 * DELETE /api/accounting/bank/connections/:id - Disconnect (soft-delete)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET — Single connection details
// ---------------------------------------------------------------------------

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "open_banking");
    if (featureGate) return featureGate;

    const { data: connection, error } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !connection) {
      throw new ApiError(404, "Connexion bancaire non trouvee");
    }

    // Fetch latest transactions count for this connection
    const { count: txCount } = await supabase
      .from("bank_transactions")
      .select("*", { count: "exact", head: true })
      .eq("connection_id", id);

    // Fetch reconciliation stats
    const { count: pendingCount } = await supabase
      .from("bank_transactions")
      .select("*", { count: "exact", head: true })
      .eq("connection_id", id)
      .eq("reconciliation_status", "pending");

    return NextResponse.json({
      success: true,
      data: {
        ...connection,
        transaction_count: txCount ?? 0,
        pending_reconciliation: pendingCount ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Disconnect (soft-delete: set is_active=false)
// ---------------------------------------------------------------------------

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Acces reserve aux administrateurs");
    }

    const featureGate = await requireAccountingAccess(profile.id, "open_banking");
    if (featureGate) return featureGate;

    const { data: existing } = await supabase
      .from("bank_connections")
      .select("id, bank_name")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new ApiError(404, "Connexion bancaire non trouvee");
    }

    const { error } = await supabase
      .from("bank_connections")
      .update({
        sync_status: "disconnected",
        is_active: false,
        error_message: "Deconnecte manuellement par l'utilisateur",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[Bank Connections] Delete error:", error);
      throw new ApiError(500, "Erreur lors de la deconnexion");
    }

    return NextResponse.json({
      success: true,
      message: `Connexion ${existing.bank_name} deconnectee`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
