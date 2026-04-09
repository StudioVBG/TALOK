export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * GET /api/diagnostics/expiring?days=60
 * Returns diagnostics expiring within the given number of days for the current user's properties.
 */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "60", 10);
    if (isNaN(days) || days < 1 || days > 365) {
      throw new ApiError(400, "days doit être entre 1 et 365");
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const todayStr = today.toISOString().split("T")[0];
    const futureStr = futureDate.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("property_diagnostics")
      .select(`
        *,
        properties!inner(id, adresse_complete, owner_id)
      `)
      .eq("properties.owner_id", profile.id)
      .not("expiry_date", "is", null)
      .lte("expiry_date", futureStr)
      .order("expiry_date", { ascending: true });

    if (error) throw error;

    const diagnostics = (data ?? []).map((d) => {
      const expiryDate = new Date(d.expiry_date!);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...d,
        days_until_expiry: daysUntilExpiry,
        is_expired: daysUntilExpiry < 0,
        urgency:
          daysUntilExpiry < 0
            ? "expired"
            : daysUntilExpiry <= 30
              ? "urgent"
              : "warning",
      };
    });

    return NextResponse.json({
      diagnostics,
      total: diagnostics.length,
      expired: diagnostics.filter((d) => d.is_expired).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
