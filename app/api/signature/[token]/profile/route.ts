// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
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
    // D'abord, vérifier si un profil existe avec cet email
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", tokenData.tenantEmail)
      .maybeSingle();

    let tenantProfileId = existingProfile?.id;

    if (!tenantProfileId) {
      // Créer un nouveau profil pour le locataire
      const { data: newProfile, error: profileError } = await serviceClient
        .from("profiles")
        .insert({
          role: "tenant",
          nom: validated.nom,
          prenom: validated.prenom,
          telephone: validated.telephone,
          email: tokenData.tenantEmail,
        })
        .select("id")
        .single();

      if (profileError) {
        console.error("Erreur création profil:", profileError);
        return NextResponse.json(
          { error: "Erreur lors de la création du profil" },
          { status: 500 }
        );
      }
      tenantProfileId = newProfile.id;
    } else {
      // Mettre à jour le profil existant
      await serviceClient
        .from("profiles")
        .update({
          nom: validated.nom,
          prenom: validated.prenom,
          telephone: validated.telephone,
        })
        .eq("id", tenantProfileId);
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

