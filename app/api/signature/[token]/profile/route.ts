// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token (format: leaseId:email:timestamp en base64url)
function decodeToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    return { leaseId, tenantEmail, timestamp: parseInt(timestampStr, 10) };
  } catch {
    return null;
  }
}

// Vérifier si le token est expiré (7 jours)
function isTokenExpired(timestamp: number): boolean {
  return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
}

// Schéma de validation du profil
const profileSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  prenom: z.string().min(1, "Prénom requis"),
  email: z.string().email().optional(),
  dateNaissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  lieuNaissance: z.string().min(1, "Lieu de naissance requis"),
  nationalite: z.string().default("Française"),
  telephone: z.string().min(10, "Téléphone invalide"),
  adresseActuelle: z.string().optional(),
  situationPro: z.string().optional(),
  revenus: z.string().optional(),
  identity_method: z.string().optional(),
  identity_verified: z.boolean().optional(),
});

/**
 * Cherche un utilisateur existant par email dans auth.users
 */
async function findAuthUserByEmail(email: string): Promise<string | null> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (error || !data?.users) {
      console.log("[Signature] Impossible de lister les users:", error?.message);
      return null;
    }

    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return user?.id || null;
  } catch (e) {
    console.log("[Signature] Erreur recherche auth user:", e);
    return null;
  }
}

/**
 * POST /api/signature/[token]/profile
 * Sauvegarder le profil du locataire
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    const { token } = await params;
    
    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le bail via l'ID
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", tokenData.leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier le statut
    if (lease.statut !== "pending_signature" && lease.statut !== "draft") {
      return NextResponse.json(
        { error: "Ce bail n'est plus en attente de signature" },
        { status: 400 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validated = profileSchema.parse(body);

    // Créer ou récupérer le profil du locataire
    let tenantProfileId: string | null = null;
    let existingProfile: { id: string; user_id?: string } | null = null;
    let authUserId: string | null = null;

    // 1. Chercher si un utilisateur auth existe avec cet email
    authUserId = await findAuthUserByEmail(tokenData.tenantEmail);
    if (authUserId) {
      console.log("[Signature] ✅ Utilisateur auth trouvé:", authUserId);
    }

    // 2. Chercher un profil existant par user_id ou email
    try {
      // D'abord par user_id si on en a un
      if (authUserId) {
        const { data, error } = await serviceClient
          .from("profiles")
          .select("id, user_id")
          .eq("user_id", authUserId)
          .maybeSingle();
        
        if (!error && data) {
          existingProfile = data;
          console.log("[Signature] ✅ Profil trouvé par user_id:", data.id);
        }
      }

      // Sinon par email
      if (!existingProfile) {
        const { data, error } = await serviceClient
          .from("profiles")
          .select("id, user_id")
          .eq("email", tokenData.tenantEmail)
          .maybeSingle();
        
        if (!error && data) {
          existingProfile = data;
          console.log("[Signature] ✅ Profil trouvé par email:", data.id);
        } else if (error) {
          console.log("[Signature] Recherche par email échouée:", error.message);
        }
      }
    } catch (e) {
      console.log("[Signature] Erreur recherche profil, on continue...");
    }

    if (existingProfile) {
      // Profil existant trouvé, le mettre à jour
      tenantProfileId = existingProfile.id;
      
      try {
        // Mettre à jour avec le user_id si disponible et pas déjà lié
        const updateData: Record<string, any> = {
          nom: validated.nom,
          prenom: validated.prenom,
          telephone: validated.telephone,
        };

        // CRITIQUE: Lier le profil au compte auth si pas déjà fait
        if (authUserId && !existingProfile.user_id) {
          updateData.user_id = authUserId;
          console.log("[Signature] 🔗 Liaison profil → compte auth:", authUserId);
        }

        await serviceClient
          .from("profiles")
          .update(updateData)
          .eq("id", tenantProfileId);
        
        console.log("[Signature] ✅ Profil existant mis à jour:", tenantProfileId);
      } catch (e) {
        console.log("[Signature] Erreur mise à jour profil (non bloquante)");
      }
    } else {
      // Créer un nouveau profil pour le locataire
      let profileData: Record<string, any> = {
        role: "tenant",
        nom: validated.nom,
        prenom: validated.prenom,
        telephone: validated.telephone,
      };

      // CRITIQUE: Lier au compte auth existant si disponible
      if (authUserId) {
        profileData.user_id = authUserId;
        console.log("[Signature] 🔗 Nouveau profil sera lié au compte:", authUserId);
      }

      // Essayer d'ajouter l'email
      try {
        const { data: newProfile, error: profileError } = await serviceClient
          .from("profiles")
          .insert({ ...profileData, email: tokenData.tenantEmail })
          .select("id")
          .single();

        if (!profileError && newProfile) {
          tenantProfileId = newProfile.id;
          console.log("[Signature] ✅ Nouveau profil créé avec email:", tenantProfileId);
        } else if (profileError) {
          // Si erreur de colonne manquante, réessayer sans email
          if (profileError.message?.includes("email") || profileError.code === "42703") {
            console.log("[Signature] Colonne email manquante, création sans email...");
            
            const { data: newProfile2, error: profileError2 } = await serviceClient
              .from("profiles")
              .insert(profileData)
              .select("id")
              .single();

            if (!profileError2 && newProfile2) {
              tenantProfileId = newProfile2.id;
              console.log("[Signature] ✅ Nouveau profil créé sans email:", tenantProfileId);
            } else {
              throw profileError2 || new Error("Impossible de créer le profil");
            }
          } else if (profileError.code === "23505") {
            // Doublon - essayer de récupérer par téléphone ou user_id
            let retryProfile = null;
            
            if (authUserId) {
              const { data } = await serviceClient
                .from("profiles")
                .select("id")
                .eq("user_id", authUserId)
                .maybeSingle();
              retryProfile = data;
            }

            if (!retryProfile) {
              const { data } = await serviceClient
                .from("profiles")
                .select("id")
                .eq("telephone", validated.telephone)
                .maybeSingle();
              retryProfile = data;
            }
            
            if (retryProfile) {
              tenantProfileId = retryProfile.id;
              console.log("[Signature] ✅ Profil récupéré après doublon:", tenantProfileId);
              
              // Lier au compte auth si pas fait
              if (authUserId) {
                await serviceClient
                  .from("profiles")
                  .update({ user_id: authUserId })
                  .eq("id", tenantProfileId)
                  .is("user_id", null);
              }
            } else {
              return NextResponse.json(
                { error: "Un compte existe déjà avec ces informations" },
                { status: 409 }
              );
            }
          } else {
            throw profileError;
          }
        }
      } catch (error: any) {
        console.error("[Signature] Erreur création profil:", error?.message || error);
        return NextResponse.json(
          { error: "Erreur lors de la création du profil" },
          { status: 500 }
        );
      }
    }
    
    // Vérifier qu'on a bien un ID
    if (!tenantProfileId) {
      return NextResponse.json(
        { error: "Impossible de créer ou trouver le profil" },
        { status: 500 }
      );
    }

    // Vérifier si le locataire est déjà signataire
    const { data: existingSigner } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("role", "locataire_principal")
      .maybeSingle();

    if (existingSigner) {
      // Mettre à jour le signataire avec le profile_id
      await serviceClient
        .from("lease_signers")
        .update({ profile_id: tenantProfileId })
        .eq("id", existingSigner.id);
    } else {
      // Ajouter le locataire comme signataire
      await serviceClient
        .from("lease_signers")
        .insert({
          lease_id: lease.id,
          profile_id: tenantProfileId,
          role: "locataire_principal",
          signature_status: "pending",
        });
    }

    return NextResponse.json({
      success: true,
      message: "Profil enregistré avec succès",
      lease_id: lease.id,
      tenant_profile_id: tenantProfileId,
    });

  } catch (error: any) {
    console.error("Erreur API profile:", error);
    
    if (error instanceof z.ZodError) {
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

