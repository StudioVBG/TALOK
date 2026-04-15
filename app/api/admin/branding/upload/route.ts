export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

export async function POST(request: Request) {
  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organization_id") as string | null;

    if (!file || !organizationId) {
      return NextResponse.json(
        { error: "Fichier et organization_id requis" },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `branding/${organizationId}/logo-${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Branding] Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("assets")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (error) {
    console.error("[Branding] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
