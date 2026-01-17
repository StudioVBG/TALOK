export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schéma de validation pour les occupants
const addOccupantSchema = z.object({
  lease_id: z.string().uuid("ID de bail invalide"),
  first_name: z.string().min(1, "Prénom requis").max(100),
  last_name: z.string().min(1, "Nom requis").max(100),
  relationship: z.enum(["conjoint", "enfant", "parent", "ami", "autre"]).optional(),
  email: z.string().email("Email invalide").optional().nullable(),
});

/**
 * GET /api/me/occupants - Récupérer les occupants du foyer
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les baux où l'utilisateur est membre
    const { data: userLeases } = await supabase
      .from("roommates")
      .select("lease_id")
      .eq("user_id", user.id as any)
      .is("left_on", null);

    if (!userLeases || userLeases.length === 0) {
      return NextResponse.json({ occupants: [] });
    }

    const leaseIds = userLeases.map((l: any) => l.lease_id);

    // Récupérer tous les occupants de ces baux
    const { data: roommates, error } = await supabase
      .from("roommates")
      .select(`
        *,
        lease:leases(id, property:properties(adresse_complete))
      `)
      .in("lease_id", leaseIds)
      .is("left_on", null)
      .order("joined_on", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ occupants: roommates });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/me/occupants - Ajouter un occupant au foyer
 * 
 * Les occupants sont des personnes vivant dans le logement sans être signataires du bail.
 * Ils ont un identifiant unique (occupant_reference) pour éviter les conflits.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Valider les données d'entrée
    const body = await request.json();
    const validationResult = addOccupantSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { lease_id, first_name, last_name, relationship, email } = validationResult.data;

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id, role")
      .eq("lease_id", lease_id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // Seul le locataire principal peut ajouter des occupants
    const roommateData = roommate as any;
    if (roommateData.role !== "principal") {
      return NextResponse.json(
        { error: "Seul le locataire principal peut ajouter des occupants" },
        { status: 403 }
      );
    }

    // Vérifier le nombre d'occupants existants (limite à 10 par bail)
    const { count: occupantCount } = await supabase
      .from("roommates")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", lease_id as any)
      .eq("role", "occupant")
      .is("left_on", null);

    if (occupantCount && occupantCount >= 10) {
      return NextResponse.json(
        { error: "Nombre maximum d'occupants atteint (10)" },
        { status: 400 }
      );
    }

    // Vérifier si un occupant avec le même email existe déjà sur ce bail
    if (email) {
      const { data: existingOccupant } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", lease_id as any)
        .eq("email", email)
        .is("left_on", null)
        .maybeSingle();

      if (existingOccupant) {
        return NextResponse.json(
          { error: "Un occupant avec cet email existe déjà sur ce bail" },
          { status: 409 }
        );
      }
    }

    // Récupérer le profil du créateur (pour audit)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    // Créer l'occupant avec un occupant_reference unique
    // Note: user_id est maintenant le créateur, pas l'occupant
    // L'occupant_reference permet de distinguer plusieurs occupants
    const { data: newOccupant, error: insertError } = await supabase
      .from("roommates")
      .insert({
        lease_id,
        user_id: user.id, // Créateur de l'entrée (locataire principal)
        profile_id: profile ? (profile as any).id : null,
        role: "occupant",
        first_name,
        last_name,
        weight: 0, // Pas de part de paiement par défaut
        relationship: relationship || null,
        email: email || null,
        // occupant_reference est généré automatiquement par défaut uuid_generate_v4()
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("Erreur création occupant:", insertError);
      
      // Gestion spécifique des erreurs de contrainte
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Cet occupant existe déjà sur ce bail" },
          { status: 409 }
        );
      }
      
      throw insertError;
    }

    // Journaliser l'ajout
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "occupant_added",
      entity_type: "roommates",
      entity_id: (newOccupant as any).id,
      metadata: {
        lease_id,
        occupant_name: `${first_name} ${last_name}`,
        relationship,
      },
    } as any);

    return NextResponse.json({ 
      occupant: newOccupant,
      message: "Occupant ajouté avec succès",
    });
  } catch (error: unknown) {
    console.error("Erreur API occupants POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/me/occupants/[id] - Supprimer un occupant
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const occupantId = params.id;

    // Récupérer l'occupant
    const { data: occupant } = await supabase
      .from("roommates")
      .select("*, lease:leases(id)")
      .eq("id", occupantId as any)
      .single();

    if (!occupant) {
      return NextResponse.json(
        { error: "Occupant non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const { data: userRoommate } = await supabase
      .from("roommates")
      .select("role")
      .eq("lease_id", (occupant as any).lease_id)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    const userRoommateData = userRoommate as any;
    if (!userRoommateData || userRoommateData.role !== "principal") {
      return NextResponse.json(
        { error: "Seul le locataire principal peut supprimer des occupants" },
        { status: 403 }
      );
    }

    // Marquer comme parti au lieu de supprimer
    const { error } = await supabase
      .from("roommates")
      .update({ left_on: new Date().toISOString().split("T")[0] } as any)
      .eq("id", occupantId as any);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





