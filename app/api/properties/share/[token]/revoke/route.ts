export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceRoleClient } from "@/lib/server/service-role-client";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

interface RevokePayload {
  reason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message, details: (authError as any).details },
        { status: authError.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseClient = getTypedSupabaseClient(supabase);
    const body = (await request.json().catch(() => ({}))) as RevokePayload;
    const { client: serviceClient } = getServiceRoleClient();

    const { data: tokenRecord, error: tokenError } = await serviceClient
      .from("property_share_tokens")
      .select("id, property_id, revoked_at")
      .eq("token", params.token as any)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
    }

    const tokenRecordData = tokenRecord as any;
    if (tokenRecordData.revoked_at) {
      return NextResponse.json({ error: "Lien déjà révoqué." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select("owner_id")
      .eq("id", tokenRecordData.property_id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const profileData = profile as any;
    const propertyData = property as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = propertyData.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas révoquer ce lien." },
        { status: 403 }
      );
    }

    const { error: updateError } = await serviceClient
      .from("property_share_tokens")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: profileData.id,
        revoke_reason: body.reason ?? null,
      } as any)
      .eq("id", tokenRecordData.id as any);

    if (updateError) {
      console.error("token revoke error", updateError);
      return NextResponse.json({ error: "Impossible de révoquer le lien." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("POST /api/properties/share/[token]/revoke error", error);
    return NextResponse.json(
      { error: error?.message ?? "Erreur serveur lors de la révocation." },
      { status: 500 }
    );
  }
}


