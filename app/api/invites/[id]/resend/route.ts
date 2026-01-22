export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { invitationsService } from "@/features/onboarding/services/invitations.service";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
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

    const invitationId = id;

    // Vérifier que l'utilisateur est le créateur de l'invitation
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("id" in profile)) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: invitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId as any)
      .eq("created_by", (profile as any).id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation non trouvée" }, { status: 404 });
    }

    // Renvoyer l'invitation
    const newInvitation = await invitationsService.resendInvitation(invitationId);

    return NextResponse.json({ success: true, invitation: newInvitation });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

