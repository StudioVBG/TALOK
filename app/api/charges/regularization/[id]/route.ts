export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/helpers/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: regularization, error } = await supabase
      .from("lease_charge_regularizations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json({ regularization });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
