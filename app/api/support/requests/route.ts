export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { service, subject, message } = body;

    if (!service || !subject) {
      return NextResponse.json(
        { error: "Service et sujet requis" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        created_by_profile_id: profile.id,
        titre: `[Support] ${subject}`,
        description: message || "",
        priorite: "normale",
        statut: "open",
        metadata: { service, source: "support_page" },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Support] Error creating ticket:", error);
      return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
    }

    // Notify admins
    import("@/lib/services/admin-notification.service").then(({ notifyAdmins }) =>
      notifyAdmins({
        type: "new_ticket",
        title: "Nouveau ticket support",
        body: `${profile.prenom || ""} ${profile.nom || ""} — ${subject}`,
        actionUrl: "/admin/support",
        metadata: { ticket_id: ticket.id, service },
      })
    ).catch(() => {});

    return NextResponse.json({ success: true, ticket_id: ticket.id });
  } catch (error) {
    console.error("[Support] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
