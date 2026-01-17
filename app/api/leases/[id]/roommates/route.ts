export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

// Schéma pour ajouter un colocataire
const addRoommateSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().nullable().optional(),
  role: z.enum(["principal", "tenant"]).default("tenant"),
  weight: z.number().min(0).max(1).optional(),
  room_label: z.string().nullable().optional(),
  joined_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  has_guarantor: z.boolean().optional(),
  guarantor_email: z.string().email().nullable().optional(),
  guarantor_name: z.string().nullable().optional(),
});

// Schéma pour mettre à jour un colocataire
const updateRoommateSchema = z.object({
  roommate_id: z.string().uuid(),
  weight: z.number().min(0).max(1).optional(),
  left_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  room_label: z.string().nullable().optional(),
});

/**
 * GET /api/leases/[id]/roommates
 * Récupérer tous les colocataires d'un bail
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;

    // Récupérer les roommates avec les profils
    const { data: roommates, error } = await supabase
      .from("roommates")
      .select(`
        *,
        profile:profiles(id, prenom, nom, avatar_url),
        room:rooms(id, nom, surface)
      `)
      .eq("lease_id", leaseId)
      .is("left_on", null)
      .order("joined_on", { ascending: true });

    if (error) {
      console.error("Erreur récupération roommates:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Récupérer les parts de paiement du mois en cours
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: paymentShares } = await supabase
      .from("payment_shares")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("month", currentMonth);

    // Mapper les parts aux roommates
    const roommatesWithShares = roommates?.map(rm => ({
      ...rm,
      current_payment_share: paymentShares?.find(ps => ps.roommate_id === rm.id) || null,
    }));

    return NextResponse.json({
      roommates: roommatesWithShares || [],
      count: roommates?.length || 0,
    });

  } catch (error: unknown) {
    console.error("Erreur API roommates GET:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * POST /api/leases/[id]/roommates
 * Ajouter un nouveau colocataire
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;
    const body = await request.json();
    const validated = addRoommateSchema.parse(body);

    // Récupérer le profil de l'utilisateur (doit être owner)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier que le bail existe et appartient au propriétaire
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        property_id,
        type_bail,
        loyer,
        charges_forfaitaires,
        depot_de_garantie,
        coloc_config,
        property:properties(id, owner_id, adresse_complete, code_postal, ville)
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    if ((lease.property as any)?.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Ce bail ne vous appartient pas" }, { status: 403 });
    }

    // Vérifier le nombre de places disponibles
    const { count: currentRoommates } = await supabase
      .from("roommates")
      .select("id", { count: "exact" })
      .eq("lease_id", leaseId)
      .is("left_on", null);

    const nbPlaces = lease.coloc_config?.nb_places || 10;
    if ((currentRoommates || 0) >= nbPlaces) {
      return NextResponse.json({ 
        error: "Nombre maximum de colocataires atteint",
        max_places: nbPlaces,
        current_count: currentRoommates,
      }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsersAuth } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingUsersAuth?.users?.find(
      (u) => u.email?.toLowerCase() === validated.email.toLowerCase()
    );

    let existingProfile: { id: string; user_id: string } | null = null;
    if (existingUser) {
      const { data: tenantProfile } = await serviceClient
        .from("profiles")
        .select("id, user_id")
        .eq("user_id", existingUser.id)
        .single();
      existingProfile = tenantProfile;
    }

    // Calculer le poids si non fourni
    const weight = validated.weight || (1 / nbPlaces);

    // Créer le roommate
    const roommateData: any = {
      lease_id: leaseId,
      role: validated.role,
      weight,
      joined_on: validated.joined_on || new Date().toISOString().split("T")[0],
      invitation_status: existingProfile ? "accepted" : "pending",
      invited_email: validated.email,
    };

    if (existingProfile) {
      roommateData.user_id = existingProfile.user_id;
    }

    const { data: roommate, error: roommateError } = await serviceClient
      .from("roommates")
      .insert(roommateData)
      .select()
      .single();

    if (roommateError) {
      console.error("Erreur création roommate:", roommateError);
      return NextResponse.json({ error: roommateError.message }, { status: 500 });
    }

    // Créer la part de dépôt de garantie
    if (lease.depot_de_garantie && lease.depot_de_garantie > 0) {
      const depositAmount = lease.depot_de_garantie * weight;
      await serviceClient
        .from("deposit_shares")
        .insert({
          lease_id: leaseId,
          roommate_id: roommate.id,
          amount: depositAmount,
          status: "pending",
        });
    }

    // Si le profil existe, l'ajouter comme signataire et notifier
    if (existingProfile) {
      await serviceClient
        .from("lease_signers")
        .insert({
          lease_id: leaseId,
          profile_id: existingProfile.id,
          role: validated.role === "principal" ? "locataire_principal" : "colocataire",
          signature_status: "pending",
        });

      await serviceClient
        .from("notifications")
        .insert({
          user_id: existingProfile.user_id,
          type: "roommate_added",
          title: "🏠 Vous êtes ajouté à une colocation",
          body: `Vous avez été ajouté à la colocation ${(lease.property as any)?.adresse_complete}. Votre part : ${Math.round(weight * 100)}%.`,
          read: false,
          metadata: { lease_id: leaseId, weight },
        });
    }

    // Envoyer l'email d'invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteToken = Buffer.from(`${leaseId}:${validated.email}:${Date.now()}`).toString("base64url");
    const inviteUrl = `${appUrl}/signature/${inviteToken}`;

    let emailSent = false;
    try {
      const property = lease.property as any;
      const rentShare = Math.round((lease.loyer || 0) * weight);
      const emailResult = await sendLeaseInviteEmail({
        to: validated.email,
        tenantName: validated.name || undefined,
        ownerName: `${profile.prenom} ${profile.nom}`,
        propertyAddress: `${property?.adresse_complete}, ${property?.code_postal} ${property?.ville}`,
        rent: rentShare,
        charges: Math.round((lease.charges_forfaitaires || 0) * weight),
        leaseType: "colocation",
        inviteUrl,
      });
      emailSent = emailResult.success;
    } catch (e) {
      console.error("Erreur envoi email:", e);
    }

    // Recalculer les parts de paiement pour le mois en cours
    try {
      await serviceClient.rpc("recalculate_payment_shares", {
        p_lease_id: leaseId,
        p_month: new Date().toISOString().slice(0, 7) + "-01",
        p_trigger_type: "new_roommate",
        p_triggered_by: roommate.id,
        p_created_by: user.id,
      });
    } catch (e) {
      console.warn("Erreur recalcul payment_shares (fonction peut ne pas exister):", e);
    }

    return NextResponse.json({
      success: true,
      roommate,
      email_sent: emailSent,
      invite_url: inviteUrl,
      profile_exists: !!existingProfile,
      message: existingProfile 
        ? `${validated.email} a été ajouté et notifié.`
        : `Invitation envoyée à ${validated.email}.`,
    });

  } catch (error: unknown) {
    console.error("Erreur API roommates POST:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * PATCH /api/leases/[id]/roommates
 * Mettre à jour un colocataire (départ, changement de poids, etc.)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;
    const body = await request.json();
    const validated = updateRoommateSchema.parse(body);

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier que le roommate appartient à ce bail
    const { data: roommate, error: roommateError } = await supabase
      .from("roommates")
      .select("*")
      .eq("id", validated.roommate_id)
      .eq("lease_id", leaseId)
      .single();

    if (roommateError || !roommate) {
      return NextResponse.json({ error: "Colocataire non trouvé" }, { status: 404 });
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (validated.weight !== undefined) updateData.weight = validated.weight;
    if (validated.left_on !== undefined) updateData.left_on = validated.left_on;
    if (validated.room_label !== undefined) updateData.room_label = validated.room_label;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    // Mettre à jour
    const serviceClient = getServiceClient();
    const { data: updated, error: updateError } = await serviceClient
      .from("roommates")
      .update(updateData)
      .eq("id", validated.roommate_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Si c'est un départ, recalculer les parts
    if (validated.left_on) {
      try {
        await serviceClient.rpc("recalculate_payment_shares", {
          p_lease_id: leaseId,
          p_month: new Date().toISOString().slice(0, 7) + "-01",
          p_trigger_type: "roommate_left",
          p_triggered_by: validated.roommate_id,
          p_created_by: user.id,
        });
      } catch (e) {
        console.warn("Erreur recalcul payment_shares:", e);
      }
    }

    return NextResponse.json({
      success: true,
      roommate: updated,
      message: validated.left_on 
        ? "Départ du colocataire enregistré"
        : "Colocataire mis à jour",
    });

  } catch (error: unknown) {
    console.error("Erreur API roommates PATCH:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}
