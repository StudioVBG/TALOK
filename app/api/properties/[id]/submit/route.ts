export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante (service role key)" },
        { status: 500 }
      );
    }

    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const propertyId = params.id;

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil propriétaire introuvable" },
        { status: 404 }
      );
    }

    const profileData = profile as any;

    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select(
        `
          id,
          owner_id,
          etat,
          adresse_complete,
          usage_principal,
          type,
          surface,
          nb_pieces,
          loyer_base,
          charges_mensuelles,
          depot_garantie,
          zone_encadrement,
          loyer_reference_majoré,
          complement_loyer,
          complement_justification,
          dpe_classe_energie,
          dpe_classe_climat,
          dpe_consommation,
          dpe_emissions,
          dpe_estimation_conso_min,
          dpe_estimation_conso_max,
          permis_louer_requis,
          permis_louer_numero,
          permis_louer_date
        `
      )
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const propertyData = property as any;

    if (propertyData.owner_id !== profileData.id) {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits sur ce logement" },
        { status: 403 }
      );
    }

    if (!["draft", "rejected"].includes(propertyData.etat)) {
      return NextResponse.json(
        { error: "Ce logement est déjà soumis ou publié" },
        { status: 400 }
      );
    }

    // Déterminer le type de bien pour adapter les validations
    const propertyType = propertyData.type as string;
    const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(propertyType);
    const isParking = ["parking", "box"].includes(propertyType);
    const isLocal = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(propertyType);

    const { data: rooms, error: roomsError } = await serviceClient
      .from("rooms")
      .select("id, type_piece")
      .eq("property_id", propertyId)
      .order("ordre", { ascending: true });

    if (roomsError) {
      return NextResponse.json(
        { error: "Impossible de récupérer les pièces du logement." },
        { status: 500 }
      );
    }

    const { data: photos, error: photosError } = await serviceClient
      .from("photos")
      .select("id, room_id, tag")
      .eq("property_id", propertyId);

    if (photosError) {
      return NextResponse.json(
        { error: "Impossible de récupérer les photos du logement." },
        { status: 500 }
      );
    }

    // Vérifications basiques de complétude adaptées selon le type de bien
    const missingFields: string[] = [];
    if (!propertyData.adresse_complete) missingFields.push("adresse_complete");
    if (!propertyData.usage_principal) missingFields.push("usage_principal");
    if (!propertyData.type) missingFields.push("type");

    const loyerHC = propertyData.loyer_hc ?? propertyData.loyer_base;

    if (!loyerHC || loyerHC <= 0) missingFields.push("loyer_hc");
    if (propertyData.charges_mensuelles === null || propertyData.charges_mensuelles < 0)
      missingFields.push("charges_mensuelles");
    if (propertyData.depot_garantie === null || propertyData.depot_garantie < 0)
      missingFields.push("depot_garantie");

    // Validations spécifiques selon le type de bien
    if (isHabitation) {
      // Habitation : surface habitable, nb_pieces, DPE, chauffage/clim
      if (!propertyData.surface || propertyData.surface <= 0) missingFields.push("surface");
      if (!propertyData.nb_pieces || propertyData.nb_pieces <= 0) missingFields.push("nb_pieces");
      if (!propertyData.dpe_classe_energie) missingFields.push("dpe_classe_energie");
      if (!propertyData.dpe_classe_climat) missingFields.push("dpe_classe_climat");
      if (!propertyData.chauffage_type) missingFields.push("chauffage_type");
      if (propertyData.chauffage_type && propertyData.chauffage_type !== "aucun" && !propertyData.chauffage_energie) {
        missingFields.push("chauffage_energie");
      }
      if (!propertyData.eau_chaude_type) missingFields.push("eau_chaude_type");
      if (!propertyData.clim_presence) missingFields.push("clim_presence");
      if (propertyData.clim_presence === "fixe" && !propertyData.clim_type) {
        missingFields.push("clim_type");
      }
    } else if (isParking) {
      // Parking : pas de DPE/chauffage requis, mais surface et gabarit requis
      // Note: Les champs parking_* sont vérifiés dans la validation Zod côté frontend
      // Ici on vérifie juste les champs de base
    } else if (isLocal) {
      // Locaux : surface totale requise, pas de DPE/chauffage requis
      // Note: Les champs local_* sont vérifiés dans la validation Zod côté frontend
      // Ici on vérifie juste les champs de base
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Champs obligatoires manquants",
          details: { missing_fields: missingFields },
        },
        { status: 400 }
      );
    }

    // Validation DPE uniquement pour habitation
    if (isHabitation) {
      if (propertyData.dpe_classe_energie === "G") {
        return NextResponse.json(
          {
            error:
              "Les logements classés G ne peuvent plus être proposés à la location sans travaux de rénovation énergétique.",
          },
          { status: 400 }
        );
      }

      if (propertyData.dpe_consommation === null || propertyData.dpe_emissions === null) {
        return NextResponse.json(
          {
            error: "Complétez les indicateurs DPE (consommation et émissions) avant de soumettre.",
          },
          { status: 400 }
        );
      }
    }

    if (propertyData.zone_encadrement) {
      if (propertyData.loyer_reference_majoré === null) {
        return NextResponse.json(
          {
            error:
              "Pour les zones soumises à l'encadrement, le loyer de référence majoré est obligatoire.",
          },
          { status: 400 }
        );
      }
      const plafond =
        (propertyData.loyer_reference_majoré ?? 0) + (propertyData.complement_loyer ?? 0);
      if (loyerHC > plafond + 0.01) {
        return NextResponse.json(
          {
            error:
              "Le loyer dépasse le plafond autorisé. Ajustez le loyer ou fournissez une justification conforme.",
          },
          { status: 400 }
        );
      }
      if (propertyData.complement_loyer && propertyData.complement_loyer > 0 && !propertyData.complement_justification) {
        return NextResponse.json(
          {
            error:
              "Un complément de loyer nécessite une justification détaillée (caractéristique exceptionnelle).",
          },
          { status: 400 }
        );
      }
    }

    // Validation permis de louer (uniquement pour habitation)
    if (isHabitation && propertyData.permis_louer_requis && !propertyData.permis_louer_numero) {
      return NextResponse.json(
        {
          error: "Renseignez le numéro d'autorisation du permis de louer avant de soumettre.",
        },
        { status: 400 }
      );
    }

    // Validation des pièces selon le type de bien
    if (isHabitation) {
      // Habitation : pièces requises
      if (!rooms || rooms.length === 0) {
        return NextResponse.json(
          {
            error:
              "Ajoutez au minimum les pièces principales (séjour, salle de bain, WC) avant de soumettre.",
          },
          { status: 400 }
        );
      }

      const requiredRoomTypes: Array<"sejour" | "salle_de_bain" | "wc"> = [
        "sejour",
        "salle_de_bain",
        "wc",
      ];
      const roomsByType = new Set(rooms.map((room) => room.type_piece));
      const missingRoomTypes = requiredRoomTypes.filter((type) => !roomsByType.has(type));

      if (missingRoomTypes.length > 0) {
        return NextResponse.json(
          {
            error: "Pièces manquantes",
            details: { missing_rooms: missingRoomTypes },
          },
          { status: 400 }
        );
      }
    }
    // Parking et locaux : pas de pièces requises

    // Validation des photos selon le type de bien
    const photosList = photos ?? [];
    
    if (isHabitation) {
      // Habitation : au moins une photo liée à une pièce, idéalement le séjour
      const allowedRoomlessTags = new Set(["vue_generale", "exterieur"]);
      const linkedPhotos = photosList.filter((photo) => photo.room_id);

      if (linkedPhotos.length === 0) {
        return NextResponse.json(
          {
            error: "Ajoutez au moins une photo liée à une pièce (idéalement le séjour).",
          },
          { status: 400 }
        );
      }

      if (rooms && rooms.length > 0) {
        const sejourRoomIds = rooms
          .filter((room) => room.type_piece === "sejour")
          .map((room) => room.id);

        const hasSejourPhoto = linkedPhotos.some((photo) =>
          sejourRoomIds.includes(photo.room_id as string)
        );

        if (!hasSejourPhoto) {
          return NextResponse.json(
            {
              error: "Ajoutez au moins une photo rattachée au séjour.",
            },
            { status: 400 }
          );
        }
      }

      const invalidPhotos = photosList.filter(
        (photo) =>
          !photo.room_id &&
          (!photo.tag || !allowedRoomlessTags.has(photo.tag as string))
      );

      if (invalidPhotos.length > 0) {
        return NextResponse.json(
          {
            error:
              "Les photos sans pièce doivent être marquées comme vue générale ou extérieure.",
          },
          { status: 400 }
        );
      }
    } else if (isParking || isLocal) {
      // Parking/Locaux : au moins une photo avec tag valide
      const allowedTags = new Set(["vue_generale", "exterieur", "interieur", "detail"]);
      
      if (photosList.length === 0) {
        return NextResponse.json(
          {
            error: "Ajoutez au moins une photo avant de soumettre.",
          },
          { status: 400 }
        );
      }

      const invalidPhotos = photosList.filter(
        (photo) => !photo.tag || !allowedTags.has(photo.tag as string)
      );

      if (invalidPhotos.length > 0) {
        return NextResponse.json(
          {
            error:
              "Toutes les photos doivent être marquées avec un tag valide (vue générale, extérieur, intérieur, détail).",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    const { data: updatedProperty, error: updateError } = await serviceClient
      .from("properties")
      .update({
        etat: "pending",
        submitted_at: now,
        validated_at: null,
        validated_by: null,
        rejection_reason: null,
      })
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de soumettre le logement" },
        { status: 500 }
      );
    }

    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "property_submitted",
      entity_type: "property",
      entity_id: propertyId,
      metadata: {
        previous_status: propertyData.etat,
        new_status: "pending",
      },
    });

    return NextResponse.json({ property: updatedProperty });
  } catch (error: any) {
    console.error("Error in POST /api/properties/[id]/submit:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

