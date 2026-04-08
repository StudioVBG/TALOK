export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * GET /api/whitelabel/config — Get current agency's white-label config
 * PATCH /api/whitelabel/config — Update branding settings
 */

const updateSchema = z.object({
  brand_name: z.string().min(1).optional(),
  logo_url: z.string().url().nullable().optional(),
  favicon_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  font_family: z.string().optional(),
  custom_domain: z.string().nullable().optional(),
  subdomain: z.string().nullable().optional(),
  company_name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  siret: z.string().nullable().optional(),
  carte_g_number: z.string().optional(),
  carte_g_expiry: z.string().nullable().optional(),
  caisse_garantie: z.string().nullable().optional(),
  caisse_garantie_montant: z.number().nullable().optional(),
  rcp_assurance: z.string().nullable().optional(),
  show_powered_by_talok: z.boolean().optional(),
  custom_email_sender: z.string().email().nullable().optional(),
});

async function getAgencyProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "agency" && profile.role !== "admin" && profile.role !== "platform_admin")) {
    return null;
  }

  return profile;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const profile = await getAgencyProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: config, error } = await supabase
      .from("whitelabel_configs")
      .select("*")
      .eq("agency_profile_id", profile.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: config || null });
  } catch (error: unknown) {
    console.error("[whitelabel/config GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAgencyProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Check if config exists
    const { data: existing } = await supabase
      .from("whitelabel_configs")
      .select("id")
      .eq("agency_profile_id", profile.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Configuration white-label non trouvee. Creez-la d'abord." },
        { status: 404 }
      );
    }

    const { data: updated, error } = await supabase
      .from("whitelabel_configs")
      .update(validated)
      .eq("agency_profile_id", profile.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: updated });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Donnees invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[whitelabel/config PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
