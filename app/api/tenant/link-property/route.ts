export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";
import { withSecurity } from "@/lib/api/with-security";

const linkPropertySchema = z.object({
  code: z.string().min(1, "Code requis").max(50),
});

/**
 * POST /api/tenant/link-property
 *
 * Lie un locataire à une propriété via le unique_code.
 * Si un bail actif/pending existe sur cette propriété,
 * crée automatiquement un lease_signer pour le locataire.
 *
 * Les triggers existants gèrent ensuite :
 *  - trigger_auto_upgrade_draft_on_signer : draft → pending_signature
 *  - trigger_auto_link_signer_on_insert : résout profile_id
 */
export const POST = withSecurity(
  async function POST(request: Request) {
    try {
      const { user, error } = await getAuthenticatedUser(request);

      if (error || !user) {
        return NextResponse.json(
          { error: "Non authentifié" },
          { status: 401 }
        );
      }

      const body = await request.json();
      const { code } = linkPropertySchema.parse(body);

      const serviceClient = getServiceClient();

      // 1. Récupérer le profil du locataire
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id, role, email, prenom, nom")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: "Profil non trouvé" },
          { status: 404 }
        );
      }

      if (profile.role !== "tenant") {
        return NextResponse.json(
          { error: "Seuls les locataires peuvent lier un logement" },
          { status: 403 }
        );
      }

      // 2. Trouver la propriété via le code
      const { data: property, error: propError } = await serviceClient
        .from("properties")
        .select("id, owner_id, adresse_complete, ville, type, unique_code")
        .eq("unique_code", code.toUpperCase().trim())
        .single();

      if (propError || !property) {
        return NextResponse.json(
          { error: "Code de logement invalide" },
          { status: 404 }
        );
      }

      // 3. Vérifier que le locataire n'est pas déjà lié à cette propriété
      const { data: existingSigners } = await serviceClient
        .from("lease_signers")
        .select("id, lease_id")
        .eq("profile_id", profile.id);

      if (existingSigners && existingSigners.length > 0) {
        const existingLeaseIds = existingSigners.map((s) => s.lease_id);

        const { data: existingLeases } = await serviceClient
          .from("leases")
          .select("id, property_id")
          .in("id", existingLeaseIds)
          .eq("property_id", property.id);

        if (existingLeases && existingLeases.length > 0) {
          return NextResponse.json(
            {
              error: "Vous êtes déjà lié à ce logement",
              property: {
                id: property.id,
                address: property.adresse_complete,
                city: property.ville,
              },
              lease_id: existingLeases[0].id,
              already_linked: true,
            },
            { status: 409 }
          );
        }
      }

      // 4. Trouver un bail actif ou en attente sur cette propriété
      const { data: lease, error: leaseError } = await serviceClient
        .from("leases")
        .select("id, statut, type_bail, loyer")
        .eq("property_id", property.id)
        .in("statut", [
          "active",
          "pending_signature",
          "fully_signed",
          "partially_signed",
          "draft",
        ])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseError) {
        console.error(
          "[link-property] Erreur recherche bail:",
          leaseError.message
        );
        return NextResponse.json(
          { error: "Erreur lors de la recherche du bail" },
          { status: 500 }
        );
      }

      if (!lease) {
        return NextResponse.json(
          {
            error:
              "Aucun bail actif trouvé pour ce logement. Contactez votre propriétaire.",
            property: {
              id: property.id,
              address: property.adresse_complete,
              city: property.ville,
            },
          },
          { status: 404 }
        );
      }

      // 5. Vérifier qu'il n'y a pas déjà un signer orphelin avec cet email
      const userEmail = (user.email || "").toLowerCase().trim();
      const { data: orphanSigner } = await serviceClient
        .from("lease_signers")
        .select("id, profile_id")
        .eq("lease_id", lease.id)
        .ilike("invited_email", userEmail)
        .maybeSingle();

      let signerId: string;

      if (orphanSigner) {
        // Lier le signer orphelin existant
        if (!orphanSigner.profile_id) {
          const { error: updateError } = await serviceClient
            .from("lease_signers")
            .update({ profile_id: profile.id })
            .eq("id", orphanSigner.id);

          if (updateError) {
            console.error(
              "[link-property] Erreur liaison signer orphelin:",
              updateError.message
            );
            return NextResponse.json(
              { error: "Erreur lors de la liaison" },
              { status: 500 }
            );
          }
        }
        signerId = orphanSigner.id;
      } else {
        // 6. Créer un nouveau lease_signer
        const { data: newSigner, error: signerError } = await serviceClient
          .from("lease_signers")
          .insert({
            lease_id: lease.id,
            profile_id: profile.id,
            invited_email: userEmail,
            invited_name: [profile.prenom, profile.nom]
              .filter(Boolean)
              .join(" ") || null,
            role: "locataire_principal",
            signature_status: "pending",
          } as Record<string, unknown>)
          .select("id")
          .single();

        if (signerError || !newSigner) {
          console.error(
            "[link-property] Erreur création signer:",
            signerError?.message
          );
          return NextResponse.json(
            {
              error:
                signerError?.message || "Erreur lors de la création du lien",
            },
            { status: 500 }
          );
        }
        signerId = newSigner.id;
      }

      // 7. Notifier le propriétaire
      try {
        const tenantName =
          [profile.prenom, profile.nom].filter(Boolean).join(" ") ||
          user.email ||
          "Un locataire";

        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("user_id")
          .eq("id", property.owner_id)
          .single();

        if (ownerProfile?.user_id) {
          await serviceClient.rpc("create_notification", {
            p_recipient_id: property.owner_id,
            p_type: "tenant_linked",
            p_title: "Nouveau locataire lié",
            p_message: `${tenantName} s'est lié à ${property.adresse_complete} via le code logement.`,
            p_link: "/owner/leases",
            p_related_id: lease.id,
            p_related_type: "lease",
          });
        }
      } catch (notifErr) {
        console.warn(
          "[link-property] Notification non-bloquante échouée:",
          notifErr
        );
      }

      return NextResponse.json({
        success: true,
        property: {
          id: property.id,
          address: property.adresse_complete,
          city: property.ville,
          type: property.type,
        },
        lease_id: lease.id,
        signer_id: signerId,
        message: "Vous êtes maintenant lié à ce logement.",
      });
    } catch (error: unknown) {
      console.error("[link-property] Erreur:", error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Données invalides", details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Erreur serveur",
        },
        { status: 500 }
      );
    }
  },
  { routeName: "POST /api/tenant/link-property", csrf: true }
);
