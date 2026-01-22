export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/helpers/url";
import { getServiceRoleClient } from "@/lib/server/service-role-client";
import { PROPERTY_SHARE_SELECT } from "@/lib/server/share-tokens";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { client: serviceClient } = getServiceRoleClient();

    const { data: share, error: shareError } = await serviceClient
      .from("property_share_tokens")
      .select("property_id, expires_at, revoked_at")
      .eq("token", token)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
    }

    if (share.revoked_at) {
      return NextResponse.json({ error: "Lien révoqué." }, { status: 410 });
    }

    if (new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: "Lien expiré." }, { status: 410 });
    }

    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select(PROPERTY_SHARE_SELECT)
      .eq("id", share.property_id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable." }, { status: 404 });
    }

    const sanitizedProperty = sanitizeProperty(property as Record<string, any>);

    const baseUrl = getBaseUrl().replace(/\/$/, "");

    return NextResponse.json({
      property: sanitizedProperty,
      share: {
        expiresAt: share.expires_at,
        token: token,
        shareUrl: `${baseUrl}/properties/share/${token}`,
        pdfUrl: `${baseUrl}/api/properties/share/${token}/pdf`,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/properties/share/[token] error", error);
    return NextResponse.json(
      { error: error?.message ?? "Erreur serveur lors du chargement du lien public." },
      { status: 500 }
    );
  }
}

function sanitizeProperty(property: Record<string, any>) {
  const {
    owner_id,
    created_at,
    updated_at,
    submitted_at,
    validated_at,
    validated_by,
    rejection_reason,
    unique_code,
    ...publicFields
  } = property;

  return {
    ...publicFields,
    type_bien: property.type ?? property.type_bien,
    loyer_hc: property.loyer_hc,
  };
}


