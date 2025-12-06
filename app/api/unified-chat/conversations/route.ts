/**
 * API Routes pour les conversations unifiées
 * GET /api/unified-chat/conversations - Liste des conversations
 * POST /api/unified-chat/conversations - Créer une conversation
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schéma de validation pour la création de conversation
const createConversationSchema = z.object({
  type: z.enum([
    "owner_tenant",
    "owner_provider",
    "owner_syndic",
    "tenant_provider",
    "roommates",
    "syndic_owners",
    "group",
    "ticket",
    "announcement",
  ]),
  participant_profile_ids: z.array(z.string().uuid()),
  participant_roles: z.array(
    z.enum([
      "owner",
      "tenant",
      "roommate",
      "provider",
      "syndic",
      "admin",
      "guarantor",
    ])
  ),
  property_id: z.string().uuid().optional(),
  lease_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  copro_site_id: z.string().uuid().optional(),
  subject: z.string().optional(),
  initial_message: z.string().optional(),
});

/**
 * GET /api/unified-chat/conversations
 * Récupère toutes les conversations de l'utilisateur
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

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer le type de conversation filtré (optionnel)
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Construire la requête
    let query = supabase
      .from("unified_conversations")
      .select(
        `
        *,
        conversation_participants!inner (
          profile_id,
          participant_role,
          unread_count,
          can_write,
          is_admin,
          left_at,
          profiles:profiles (
            id,
            prenom,
            nom,
            avatar_url
          )
        ),
        property:properties (
          id,
          adresse_complete,
          ville
        )
      `
      )
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (type) {
      query = query.eq("type", type);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      console.error("Erreur récupération conversations:", convError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des conversations" },
        { status: 500 }
      );
    }

    // Filtrer et enrichir les conversations
    const enrichedConversations = (conversations || [])
      .filter((conv: Record<string, unknown>) => {
        const participants = conv.conversation_participants as Array<{
          profile_id: string;
          left_at?: string | null;
        }>;
        return participants.some(
          (p) => p.profile_id === profile.id && !p.left_at
        );
      })
      .map((conv: Record<string, unknown>) => {
        const participants = conv.conversation_participants as Array<{
          profile_id: string;
          participant_role: string;
          unread_count: number;
          can_write: boolean;
          is_admin: boolean;
          left_at?: string | null;
          profiles?: {
            id: string;
            prenom?: string;
            nom?: string;
            avatar_url?: string | null;
          };
        }>;

        const myParticipant = participants.find(
          (p) => p.profile_id === profile.id
        );
        const otherParticipants = participants.filter(
          (p) => p.profile_id !== profile.id && !p.left_at
        );
        const otherParticipant = otherParticipants[0];
        const property = conv.property as {
          id?: string;
          adresse_complete?: string;
          ville?: string;
        } | null;

        return {
          id: conv.id,
          type: conv.type,
          property_id: conv.property_id,
          lease_id: conv.lease_id,
          ticket_id: conv.ticket_id,
          copro_site_id: conv.copro_site_id,
          subject: conv.subject,
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          status: conv.status,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          my_unread_count: myParticipant?.unread_count || 0,
          property_address: property
            ? `${property.adresse_complete || ""}, ${property.ville || ""}`.trim()
            : null,
          other_participant_name: otherParticipant
            ? `${otherParticipant.profiles?.prenom || ""} ${otherParticipant.profiles?.nom || ""}`.trim()
            : otherParticipants.length > 1
              ? `${otherParticipants.length} participants`
              : null,
          other_participant_avatar: otherParticipant?.profiles?.avatar_url,
          participants: participants
            .filter((p) => !p.left_at)
            .map((p) => ({
              profile_id: p.profile_id,
              participant_role: p.participant_role,
              can_write: p.can_write,
              is_admin: p.is_admin,
              unread_count: p.unread_count,
              profile_name: `${p.profiles?.prenom || ""} ${p.profiles?.nom || ""}`.trim(),
              profile_avatar: p.profiles?.avatar_url,
            })),
        };
      });

    return NextResponse.json({ conversations: enrichedConversations });
  } catch (error: unknown) {
    console.error("Erreur API conversations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unified-chat/conversations
 * Créer une nouvelle conversation
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

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const validationResult = createConversationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Vérifier que les tableaux ont la même longueur
    if (data.participant_profile_ids.length !== data.participant_roles.length) {
      return NextResponse.json(
        {
          error:
            "Le nombre de participants doit correspondre au nombre de rôles",
        },
        { status: 400 }
      );
    }

    // Créer la conversation
    const { data: conversation, error: convError } = await supabase
      .from("unified_conversations")
      .insert({
        type: data.type,
        property_id: data.property_id || null,
        lease_id: data.lease_id || null,
        ticket_id: data.ticket_id || null,
        copro_site_id: data.copro_site_id || null,
        subject: data.subject || null,
      })
      .select()
      .single();

    if (convError) {
      console.error("Erreur création conversation:", convError);
      return NextResponse.json(
        { error: "Erreur lors de la création de la conversation" },
        { status: 500 }
      );
    }

    // Préparer les participants
    const participants: Array<{
      conversation_id: string;
      profile_id: string;
      participant_role: string;
      is_admin: boolean;
    }> = [];

    // Ajouter les participants spécifiés
    for (let i = 0; i < data.participant_profile_ids.length; i++) {
      participants.push({
        conversation_id: conversation.id,
        profile_id: data.participant_profile_ids[i],
        participant_role: data.participant_roles[i],
        is_admin: data.participant_profile_ids[i] === profile.id,
      });
    }

    // S'assurer que le créateur est ajouté
    if (!data.participant_profile_ids.includes(profile.id)) {
      participants.push({
        conversation_id: conversation.id,
        profile_id: profile.id,
        participant_role: profile.role,
        is_admin: true,
      });
    }

    const { error: partError } = await supabase
      .from("conversation_participants")
      .insert(participants);

    if (partError) {
      console.error("Erreur ajout participants:", partError);
      // Supprimer la conversation créée
      await supabase
        .from("unified_conversations")
        .delete()
        .eq("id", conversation.id);
      return NextResponse.json(
        { error: "Erreur lors de l'ajout des participants" },
        { status: 500 }
      );
    }

    // Envoyer le message initial si fourni
    if (data.initial_message) {
      await supabase.from("unified_messages").insert({
        conversation_id: conversation.id,
        sender_profile_id: profile.id,
        content: data.initial_message,
        content_type: "text",
      });
    }

    return NextResponse.json(
      { conversation, message: "Conversation créée avec succès" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Erreur API création conversation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

