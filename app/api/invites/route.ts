export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ownerInviteSchema } from "@/lib/validations/onboarding";
import { invitationsService } from "@/features/onboarding/services/invitations.service";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validation
    const validated = ownerInviteSchema.parse(body);

    // Récupérer l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Créer les invitations
    const invitations = [];
    for (const email of validated.emails) {
      try {
        const invitation = await invitationsService.createInvitation({
          email,
          role: validated.role,
          property_id: (validated as any).property_id,
          unit_id: validated.unit_id,
          lease_id: validated.lease_id,
        });
        invitations.push(invitation);
      } catch (error: unknown) {
        console.error(`Erreur création invitation pour ${email}:`, error);
        // Continuer avec les autres emails
      }
    }

    return NextResponse.json({ success: true, invitations });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("id" in profile)) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les invitations créées par l'utilisateur
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("created_by", (profile as any).id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invitations });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

