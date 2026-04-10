import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    // Find all entities this EC has access to
    const { data: accesses } = await (supabase as any)
      .from("ec_access")
      .select("entity_id, access_level")
      .eq("ec_user_id", user.id)
      .eq("is_active", true)
      .is("revoked_at", null);

    if (!accesses || accesses.length === 0) {
      // Also try by email
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (!profile) return NextResponse.json({ success: true, data: { clients: [] } });

      const { data: emailAccesses } = await (supabase as any)
        .from("ec_access")
        .select("entity_id, access_level, ec_email")
        .eq("is_active", true)
        .is("revoked_at", null);

      const userEmail = user.email;
      const matchingAccesses = (emailAccesses ?? []).filter((a: { ec_email: string }) => a.ec_email === userEmail);
      if (matchingAccesses.length === 0) {
        return NextResponse.json({ success: true, data: { clients: [] } });
      }
    }

    const entityIds = (accesses ?? []).map((a: { entity_id: string }) => a.entity_id);
    const clients = [];

    for (const entityId of entityIds) {
      const { data: entity } = await supabase.from("legal_entities").select("nom").eq("id", entityId).single();
      const { count: entryCount } = await supabase.from("accounting_entries").select("id", { count: "exact", head: true }).eq("entity_id", entityId);
      const { data: exercises } = await (supabase as any).from("accounting_exercises").select("status").eq("entity_id", entityId).order("start_date", { ascending: false }).limit(1);
      const { count: annotationCount } = await (supabase as any).from("ec_annotations").select("id", { count: "exact", head: true }).eq("entity_id", entityId).eq("is_resolved", false);

      clients.push({
        entityId,
        entityName: entity?.nom ?? entityId.slice(0, 8),
        entryCount: entryCount ?? 0,
        exerciseStatus: exercises?.[0]?.status ?? "unknown",
        annotationCount: annotationCount ?? 0,
      });
    }

    return NextResponse.json({ success: true, data: { clients } });
  } catch (error) {
    return handleApiError(error);
  }
}
