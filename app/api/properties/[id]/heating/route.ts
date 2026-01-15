export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { propertyHeatingSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseClient = supabase as any;
    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select(
        "id, owner_id, type, chauffage_type, chauffage_energie, eau_chaude_type, clim_presence, clim_type"
      )
      .eq("id", params.id as any)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      heating: {
        chauffage_type: property.chauffage_type,
        chauffage_energie: property.chauffage_energie,
        eau_chaude_type: property.eau_chaude_type,
        clim_presence: property.clim_presence,
        clim_type: property.clim_type,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseClient = supabase as any;

    const body = await request.json();
    const validated = propertyHeatingSchema.parse(body);

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("owner_id, type, etat")
      .eq("id", params.id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce logement" },
        { status: 403 }
      );
    }

    if (!isAdmin && !["draft", "rejected"].includes(property.etat as string)) {
      return NextResponse.json(
        { error: "Impossible de modifier un logement soumis ou publié" },
        { status: 400 }
      );
    }

    if ((property.type as string) !== "appartement") {
      return NextResponse.json(
        { error: "Ce bloc ne s'applique qu'aux appartements" },
        { status: 400 }
      );
    }

    const heatingUpdates = {
      chauffage_type: validated.chauffage_type,
      chauffage_energie:
        validated.chauffage_type === "aucun" ? null : validated.chauffage_energie,
      eau_chaude_type: validated.eau_chaude_type ?? null,
      clim_presence: validated.clim_presence,
      clim_type:
        validated.clim_presence === "fixe" ? validated.clim_type ?? null : null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProperty, error: updateError } = await supabaseClient
      .from("properties")
      .update(heatingUpdates as any)
      .eq("id", params.id as any)
      .select(
        "id, chauffage_type, chauffage_energie, eau_chaude_type, clim_presence, clim_type"
      )
      .single();

    if (updateError || !updatedProperty) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de mettre à jour le chauffage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ heating: updatedProperty });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
