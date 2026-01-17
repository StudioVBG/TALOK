export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getBaseUrl } from "@/lib/helpers/url";
import { getServiceRoleClient } from "@/lib/server/service-role-client";

interface ShareRequestBody {
  expiresInHours?: number;
}

async function getAuthorizedContext(request: Request, propertyId: string) {
  const { user, error: authError, supabase } = await getAuthenticatedUser(request);

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user || !supabase) {
    throw new Error("Non authentifié");
  }

  const supabaseClient = supabase as any;
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id as any)
    .single();

  if (profileError || !profile) {
    throw new Error("Profil introuvable");
  }

  const profileData = profile as any;

  const { client: serviceClient } = getServiceRoleClient();

  const { data: property, error: propertyError } = await serviceClient
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId as any)
    .single();

  if (propertyError || !property) {
    throw new Error("Logement introuvable");
  }

  const isAdmin = profileData.role === "admin";
  const isOwner = property.owner_id === profileData.id;

  if (!isAdmin && !isOwner) {
    throw new Error("Seul le propriétaire ou un admin peut gérer les liens publics.");
  }

  return { serviceClient, profile, property };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { serviceClient, profile, property } = await getAuthorizedContext(request, params.id);

    let body: ShareRequestBody = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const expiresInHours =
      typeof body.expiresInHours === "number" && body.expiresInHours > 0
        ? body.expiresInHours
        : 48;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    const rawToken = crypto.randomUUID().replace(/-/g, "");
    const token = `${rawToken}${crypto.randomUUID().slice(0, 8)}`;

    const profileData = profile as any;
    const propertyData = property as any;

    const { data: shareRecord, error: insertError } = await serviceClient
      .from("property_share_tokens")
      .insert({
        property_id: propertyData.id,
        token,
        expires_at: expiresAt,
        created_by: profileData.id,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("property_share_tokens insert error", insertError);
      return NextResponse.json(
        { error: "Impossible de générer le lien de partage." },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl().replace(/\/$/, "");
    const shareUrl = `${baseUrl}/properties/share/${token}`;

    return NextResponse.json({
      share: {
        ...shareRecord,
        shareUrl,
        pdfUrl: `${baseUrl}/api/properties/share/${token}/pdf`,
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/properties/[id]/share error", error);
    return NextResponse.json(
      { error: error?.message ?? "Erreur serveur durant la génération du lien." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { serviceClient } = await getAuthorizedContext(request, params.id);
    const baseUrl = getBaseUrl().replace(/\/$/, "");

    const { data: shares, error } = await serviceClient
      .from("property_share_tokens")
      .select("*")
      .eq("property_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET share history error", error);
      return NextResponse.json({ error: "Impossible de charger les liens." }, { status: 500 });
    }

    const normalized = (shares ?? []).map((share) => ({
      ...share,
      shareUrl: `${baseUrl}/properties/share/${share.token}`,
      pdfUrl: `${baseUrl}/api/properties/share/${share.token}/pdf`,
    }));

    return NextResponse.json({ shares: normalized });
  } catch (error: unknown) {
    console.error("GET /api/properties/[id]/share error", error);
    return NextResponse.json(
      { error: error?.message ?? "Erreur lors du chargement de l'historique." },
      { status: 500 }
    );
  }
}


