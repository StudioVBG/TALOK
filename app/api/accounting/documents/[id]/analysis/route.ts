/**
 * API Route: Document Analysis Status
 * GET /api/accounting/documents/[id]/analysis — Poll analysis status
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifié");

    const { data: analysis, error } = await supabase
      .from("document_analyses")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      throw new ApiError(404, "Aucune analyse trouvée pour ce document");
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    return handleApiError(error);
  }
}
