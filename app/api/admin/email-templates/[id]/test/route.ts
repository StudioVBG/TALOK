export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderEmailTemplate } from "@/lib/email/render-template";

/**
 * POST /api/admin/email-templates/[id]/test — Envoyer un email de test
 * Body: { email: string } (adresse de destination)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const recipientEmail = body.email || user.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: "Adresse email requise" }, { status: 400 });
    }

    // Récupérer le template
    const { data: template, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!template) {
      return NextResponse.json({ error: "Template non trouvé" }, { status: 404 });
    }

    // Générer les données d'exemple à partir des available_variables
    const variables: Record<string, string> = {};
    const availableVars = template.available_variables as Array<{
      key: string;
      example: string;
    }>;
    for (const v of availableVars) {
      variables[v.key] = v.example;
    }

    // Rendre le template avec les données d'exemple
    const rendered = renderEmailTemplate(template as any, variables);

    // Envoyer via le service email existant
    const { sendEmail } = await import("@/lib/email/send-email");
    await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    return NextResponse.json({
      success: true,
      message: `Email de test envoyé à ${recipientEmail}`,
    });
  } catch (error: unknown) {
    console.error("[Admin Email Template Test POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
