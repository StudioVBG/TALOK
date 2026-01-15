export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { roomSchema } from "@/lib/validations";
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour consulter les pièces.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Vérifier que la propriété existe avec serviceClient pour éviter les problèmes RLS
    const { data: property } = await serviceClient
      .from("properties")
      .select("id")
      .eq("id", params.id as any)
      .maybeSingle();

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const { data: rooms, error: roomsError } = await serviceClient
      .from("rooms")
      .select("*")
      .eq("property_id", params.id as any)
      .order("ordre", { ascending: true });

    if (roomsError) {
      return NextResponse.json(
        { error: roomsError.message || "Erreur lors du chargement des pièces" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rooms: rooms ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

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
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour ajouter une pièce.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();
    const validated = roomSchema.parse(body);

    // Récupérer le profil avec serviceClient pour éviter les problèmes RLS
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer la propriété avec serviceClient pour éviter les problèmes RLS
    // Essayer d'abord avec toutes les colonnes, puis sans si certaines n'existent pas
    let property: any = null;
    let propertyError: any = null;
    
    const { data: propertyWithAll, error: errorWithAll } = await serviceClient
      .from("properties")
      .select("owner_id, type, etat")
      .eq("id", params.id as any)
      .maybeSingle();

    if (errorWithAll) {
      // Si l'erreur est due à une colonne manquante, réessayer sans etat et type
      if (errorWithAll.message?.includes("does not exist") || errorWithAll.message?.includes("column") || errorWithAll.code === "42703") {
        console.log(`[POST /api/properties/${params.id}/rooms] Colonne manquante détectée, réessai avec colonnes minimales`);
        const { data: propertyMinimal, error: errorMinimal } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", params.id as any)
          .maybeSingle();
        
        if (errorMinimal) {
          console.error(`[POST /api/properties/${params.id}/rooms] Erreur même avec colonnes minimales:`, errorMinimal);
          propertyError = errorMinimal;
        } else {
          property = propertyMinimal;
          // Si etat n'existe pas, on considère que c'est un draft par défaut
          if (property) {
            property.etat = "draft";
            property.type = null; // Type peut ne pas exister
          }
        }
      } else {
        console.error(`[POST /api/properties/${params.id}/rooms] Erreur non liée à une colonne manquante:`, errorWithAll);
        propertyError = errorWithAll;
      }
    } else {
      property = propertyWithAll;
    }

    if (propertyError) {
      console.error(`[POST /api/properties/${params.id}/rooms] Erreur lors de la récupération de la propriété:`, propertyError);
      throw propertyError;
    }

    if (!property) {
      console.warn(`[POST /api/properties/${params.id}/rooms] Propriété non trouvée (ID: ${params.id})`);
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    console.log(`[POST /api/properties/${params.id}/rooms] Propriété trouvée: owner_id=${property.owner_id}, etat=${property.etat || "N/A"}, type=${property.type || "N/A"}`);

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'ajouter une pièce" },
        { status: 403 }
      );
    }

    // Vérifier l'état seulement si la colonne existe
    const propertyEtat = (property as any).etat;
    if (!isAdmin && propertyEtat && !["draft", "rejected"].includes(propertyEtat as string)) {
      return NextResponse.json(
        { error: "Impossible de modifier un logement soumis ou publié" },
        { status: 400 }
      );
    }

    // Retirer la restriction sur le type "appartement" pour permettre tous les types V3
    // Les rooms peuvent maintenant être ajoutées pour tous les types de biens (appartement, maison, studio, colocation, local_commercial, bureaux, etc.)

    const { data: lastRoom } = await serviceClient
      .from("rooms")
      .select("ordre")
      .eq("property_id", params.id as any)
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastRoom?.ordre ?? -1) + 1;

    // Utiliser serviceClient pour l'insertion pour éviter les problèmes RLS
    const { data: room, error: insertError } = await serviceClient
      .from("rooms")
      .insert({
        property_id: params.id,
        type_piece: validated.type_piece,
        label_affiche: validated.label_affiche,
        surface_m2: validated.surface_m2,
        chauffage_present: validated.chauffage_present,
        chauffage_type_emetteur: validated.chauffage_present
          ? validated.chauffage_type_emetteur ?? null
          : null,
        clim_presente: validated.clim_presente,
        ordre: nextOrder,
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (insertError || !room) {
      return NextResponse.json(
        { error: insertError?.message || "Impossible d'ajouter la pièce" },
        { status: 500 }
      );
    }

    return NextResponse.json({ room }, { status: 201 });
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
