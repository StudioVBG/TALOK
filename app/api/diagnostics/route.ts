export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import {
  diagnosticCreateSchema,
  computeExpiryDate,
} from "@/lib/validations/diagnostics";

/**
 * GET /api/diagnostics?property_id=xxx
 * List diagnostics for a property
 */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property_id");
    if (!propertyId) throw new ApiError(400, "property_id requis");

    const { data, error } = await supabase
      .from("property_diagnostics")
      .select("*")
      .eq("property_id", propertyId)
      .order("diagnostic_type", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ diagnostics: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/diagnostics
 * Create or upsert a diagnostic for a property
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const body = await request.json();
    const parsed = diagnosticCreateSchema.parse(body);

    // Auto-compute expiry date if not provided
    const expiryDate =
      parsed.expiry_date ??
      computeExpiryDate(parsed.diagnostic_type, parsed.performed_date, parsed.result);

    const { data, error } = await supabase
      .from("property_diagnostics")
      .upsert(
        {
          property_id: parsed.property_id,
          diagnostic_type: parsed.diagnostic_type,
          performed_date: parsed.performed_date,
          expiry_date: expiryDate,
          result: parsed.result ?? null,
          diagnostiqueur_name: parsed.diagnostiqueur_name ?? null,
          diagnostiqueur_certification: parsed.diagnostiqueur_certification ?? null,
          document_id: parsed.document_id ?? null,
          notes: parsed.notes ?? null,
          is_valid: true,
        },
        { onConflict: "property_id,diagnostic_type" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ diagnostic: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
