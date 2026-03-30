export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: leases } = await supabase
    .from("leases")
    .select("id, date_debut, date_fin, statut, type_bail")
    .eq("property_id", propertyId)
    .order("date_debut", { ascending: false });

  return NextResponse.json({ leases: leases || [] });
}
