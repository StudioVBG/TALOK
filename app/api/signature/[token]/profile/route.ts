export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTokenCompat } from "@/lib/utils/secure-token";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Parse et normalise une date en format ISO (YYYY-MM-DD)
 * Accepte: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 */
function parseAndNormalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Format ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Format français: DD/MM/YYYY
  const frSlash = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frSlash) {
    return `${frSlash[3]}-${frSlash[2]}-${frSlash[1]}`;
  }
  
  // Format français avec tirets: DD-MM-YYYY
  const frDash = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (frDash) {
    return `${frDash[3]}-${frDash[2]}-${frDash[1]}`;
  }
  
  return null;
}

// Schéma de validation du profil avec support multi-format pour les dates
const profileSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  prenom: z.string().min(1, "Prénom requis"),
  email: z.string().email().optional(),
  dateNaissance: z.string()
    .refine(
      (val) => parseAndNormalizeDate(val) !== null,
      { message: "Date invalide (formats acceptés: JJ/MM/AAAA ou AAAA-MM-JJ)" }
    )
    .transform((val) => parseAndNormalizeDate(val)!),
  lieuNaissance: z.string().min(1, "Lieu de naissance requis"),
  nationalite: z.string().default("Française"),
  telephone: z.string().min(6, "Téléphone invalide"), // Accepte les numéros locaux (sans indicatif)
  countryCode: z.string().optional(),
  adresseActuelle: z.string().optional(),
  situationPro: z.string().optional(),
  revenus: z.string().optional(),
  identity_method: z.string().optional(),
  identity_verified: z.boolean().optional(),
});

/**
 * FIX P1-7: Cherche un utilisateur existant par email via profiles (au lieu de listUsers admin).
 * listUsers() itère sur TOUS les utilisateurs auth, ce qui est lent et non-scalable.
 * La table profiles contient déjà le user_id lié, donc on peut l'utiliser directement.
 */
async function findAuthUserByEmail(email: string): Promise<string | null> {
  try {
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("email", email.toLowerCase().trim())
      .not("user_id", "is", null)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data?.user_id || null;
  } catch (e) {
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

    // FIX: Utiliser verifyTokenCompat pour supporter les deux formats (HMAC + legacy)
    const tokenData = verifyTokenCompat(token, 7);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }

    const tenantEmail = tokenData.email;
    const serviceClient = getServiceClient();

    // Récupérer le bail via l'ID
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", tokenData.entityId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier le statut - autoriser draft, pending_signature, partially_signed, et pending_owner_signature
    // car le locataire doit pouvoir sauvegarder son profil tant que le bail n'est pas fully_signed
    const allowedStatuses = ["draft", "pending_signature", "partially_signed", "pending_owner_signature"];
    if (!allowedStatuses.includes(lease.statut)) {
      return NextResponse.json(
        { error: "Ce bail n'est plus en attente de signature" },
        { status: 400 }
      );
    }

    // Valider les données
    const body = await request.json();
    
    // Combiner countryCode + telephone pour avoir le numéro complet
    let fullPhoneNumber = body.telephone || "";
    if (body.countryCode && body.telephone) {
      // Enlever le 0 initial si présent et ajouter l'indicatif
      const cleanedNumber = body.telephone.replace(/^0+/, "").replace(/\s+/g, "");
      fullPhoneNumber = `+${body.countryCode}${cleanedNumber}`;
    }
    
    const validated = profileSchema.parse(body);
    
    // Utiliser le numéro complet pour la sauvegarde
    const phoneToSave = fullPhoneNumber || validated.telephone;

    // Créer ou récupérer le profil du locataire
    let tenantProfileId: string | null = null;
    let existingProfile: { id: string; user_id?: string } | null = null;
    let authUserId: string | null = null;

    // 1. Chercher si un utilisateur auth existe avec cet email
    authUserId = await findAuthUserByEmail(tenantEmail);
    if (authUserId) {
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
        }
      }

      // Sinon par email
      if (!existingProfile) {
        const { data, error } = await serviceClient
          .from("profiles")
          .select("id, user_id")
          .ilike("email", tenantEmail)
          .maybeSingle();

        if (!error && data) {
          existingProfile = data;
        } else if (error) {
        }
      }
    } catch (e) {
    }

    if (existingProfile) {
      // Profil existant trouvé, le mettre à jour
      tenantProfileId = existingProfile.id;
      
      try {
        // Mettre à jour avec le user_id si disponible et pas déjà lié
        const updateData: Record<string, any> = {
          nom: validated.nom,
          prenom: validated.prenom,
          telephone: phoneToSave,
        };

        // CRITIQUE: Lier le profil au compte auth si pas déjà fait
        if (authUserId && !existingProfile.user_id) {
          updateData.user_id = authUserId;
        }

        await serviceClient
          .from("profiles")
          .update(updateData)
          .eq("id", tenantProfileId);
        
      } catch (e) {
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
      }

      // Essayer d'ajouter l'email
      try {
        const { data: newProfile, error: profileError } = await serviceClient
          .from("profiles")
          .insert({ ...profileData, email: tenantEmail })
          .select("id")
          .single();

        if (!profileError && newProfile) {
          tenantProfileId = newProfile.id;
        } else if (profileError) {
          // Si erreur de colonne manquante, réessayer sans email
          if (profileError.message?.includes("email") || profileError.code === "42703") {
            
            const { data: newProfile2, error: profileError2 } = await serviceClient
              .from("profiles")
              .insert(profileData)
              .select("id")
              .single();

            if (!profileError2 && newProfile2) {
              tenantProfileId = newProfile2.id;
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
                .eq("telephone", phoneToSave)
                .maybeSingle();
              retryProfile = data;
            }
            
            if (retryProfile) {
              tenantProfileId = retryProfile.id;
              
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
      } catch (error: unknown) {
        console.error("[Signature] Erreur création profil:", (error as any)?.message || error);
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

    // Créer ou mettre à jour le tenant_profiles avec les données spécifiques locataire
    try {
      // Vérifier si tenant_profiles existe déjà
      const { data: existingTenantProfile } = await serviceClient
        .from("tenant_profiles")
        .select("id")
        .eq("profile_id", tenantProfileId)
        .maybeSingle();

      const tenantProfileData: Record<string, any> = {};
      
      // Ajouter les données si elles sont fournies
      if (validated.situationPro) {
        tenantProfileData.situation_pro = validated.situationPro;
      }
      if (validated.revenus) {
        const revenus = parseInt(validated.revenus, 10);
        if (!isNaN(revenus)) {
          tenantProfileData.revenus_mensuels = revenus;
        }
      }

      // Ajouter date et lieu de naissance dans le profil principal si possible
      // On fait chaque update séparément pour ne pas échouer si une colonne n'existe pas
      
      // Date de naissance (colonne standard)
      if (validated.dateNaissance) {
        try {
          await serviceClient
            .from("profiles")
            .update({ date_naissance: validated.dateNaissance })
            .eq("id", tenantProfileId);
        } catch (e: any) {
        }
      }
      
      // Lieu de naissance (colonne optionnelle - peut ne pas exister)
      if (validated.lieuNaissance) {
        try {
          await serviceClient
            .from("profiles")
            .update({ lieu_naissance: validated.lieuNaissance })
            .eq("id", tenantProfileId);
        } catch (e: any) {
        }
      }
      
      // Adresse (colonne optionnelle - peut ne pas exister)
      if (validated.adresseActuelle) {
        try {
          await serviceClient
            .from("profiles")
            .update({ adresse: validated.adresseActuelle })
            .eq("id", tenantProfileId);
        } catch (e: any) {
        }
      }

      // Créer ou mettre à jour tenant_profiles si on a des données
      if (Object.keys(tenantProfileData).length > 0) {
        if (existingTenantProfile) {
          await serviceClient
            .from("tenant_profiles")
            .update(tenantProfileData)
            .eq("profile_id", tenantProfileId);
        } else {
          await serviceClient
            .from("tenant_profiles")
            .insert({
              profile_id: tenantProfileId,
              ...tenantProfileData,
            });
        }
      }
    } catch (tenantProfileError: any) {
      // Non bloquant - les données supplémentaires sont optionnelles
    }

    // Chercher le signataire existant par invited_email (prioritaire) ou par profile_id
    let existingSigner: { id: string; role: string; profile_id: string | null } | null = null;
    
    // 1. D'abord par invited_email (signataire invité mais pas encore lié à un profil)
    const { data: signerByEmail } = await serviceClient
      .from("lease_signers")
      .select("id, role, profile_id")
      .eq("lease_id", lease.id)
      .ilike("invited_email", tenantEmail)
      .maybeSingle();
    
    if (signerByEmail) {
      existingSigner = signerByEmail;
    }
    
    // 2. Sinon par profile_id si le profil existe déjà
    if (!existingSigner && tenantProfileId) {
      const { data: signerByProfile } = await serviceClient
        .from("lease_signers")
        .select("id, role, profile_id")
        .eq("lease_id", lease.id)
        .eq("profile_id", tenantProfileId)
        .maybeSingle();
      
      if (signerByProfile) {
        existingSigner = signerByProfile;
      }
    }

    if (existingSigner) {
      // Mettre à jour le signataire existant avec le profile_id
      // On garde le rôle d'origine (locataire_principal, colocataire, garant)
      await serviceClient
        .from("lease_signers")
        .update({ 
          profile_id: tenantProfileId,
          // Ne pas écraser invited_email car on peut en avoir besoin pour référence
        })
        .eq("id", existingSigner.id);
      
    } else {
      // Aucun signataire trouvé - créer un nouveau (cas rare, normalement le signataire existe déjà)
      
      const { error: insertError } = await serviceClient
        .from("lease_signers")
        .insert({
          lease_id: lease.id,
          profile_id: tenantProfileId,
          invited_email: tenantEmail,
          role: "locataire_principal", // Par défaut si pas de signataire existant
          signature_status: "pending",
        });
      
      if (insertError) {
        // Si erreur de doublon, c'est OK le signataire existe déjà
        if (insertError.code !== "23505") {
          console.error("[Signature] Erreur création signataire:", insertError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profil enregistré avec succès",
      lease_id: lease.id,
      tenant_profile_id: tenantProfileId,
    });

  } catch (error: unknown) {
    console.error("Erreur API profile:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

