export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/providers/invite - Inviter un prestataire par email
 */
export async function POST(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { email, prenom, nom, phone, type_services, zones_intervention } = body;

    if (!email) {
      return NextResponse.json(
        { error: "L'email est requis" },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe déjà
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users.find((u) => u.email === email);

    let userId: string;
    let profileId: string;

    if (existingUser) {
      // Utilisateur existe déjà, vérifier le profil
      userId = existingUser.id;
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("user_id", userId)
        .single();

      if (existingProfile) {
        if (existingProfile.role !== "provider") {
          return NextResponse.json(
            { error: "Cet utilisateur existe déjà avec un autre rôle" },
            { status: 400 }
          );
        }
        profileId = existingProfile.id;
      } else {
        // Créer le profil
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            role: "provider",
            prenom: prenom || null,
            nom: nom || null,
            telephone: phone || null,
          })
          .select()
          .single();

        if (profileError) throw profileError;
        profileId = newProfile.id;
      }
    } else {
      // Créer un nouvel utilisateur avec un mot de passe temporaire
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
      
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (userError) throw userError;
      userId = newUser.user.id;

      // Créer le profil
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          role: "provider",
          prenom: prenom || null,
          nom: nom || null,
          telephone: phone || null,
        })
        .select()
        .single();

      if (profileError) throw profileError;
      profileId = newProfile.id;

      // TODO: Envoyer un email avec le mot de passe temporaire
      // await sendInvitationEmail(email, tempPassword);
    }

    // Créer ou mettre à jour le provider_profile
    const { data: existingProviderProfile } = await supabase
      .from("provider_profiles")
      .select("profile_id")
      .eq("profile_id", profileId)
      .single();

    const providerProfileData: any = {
      profile_id: profileId,
      status: "pending",
      type_services: type_services || [],
      zones_intervention: zones_intervention || null,
    };

    if (existingProviderProfile) {
      await supabase
        .from("provider_profiles")
        .update(providerProfileData)
        .eq("profile_id", profileId);
    } else {
      await supabase
        .from("provider_profiles")
        .insert(providerProfileData);
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_invited",
      entity_type: "provider_profile",
      entity_id: profileId,
      metadata: { email, invited_by: user.id },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Invitation envoyée avec succès",
      profile_id: profileId,
    });
  } catch (error: any) {
    console.error("Error in POST /api/admin/providers/invite:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





