export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { chargeSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withApiSecurity, securityPresets } from "@/lib/api-security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getHandler = async (request: Request) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil pour vérifier le rôle
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    // Pour les admins: accès complet
    if (profile.role === "admin") {
      let query = supabase.from("charges").select("*").order("created_at", { ascending: false });
      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ charges: data });
    }

    // Pour les owners: seulement leurs propriétés
    if (profile.role === "owner" || profile.role === "proprietaire") {
      // Récupérer les propriétés de l'owner
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id);

      const propertyIds = properties?.map(p => p.id) || [];

      if (propertyIds.length === 0) {
        return NextResponse.json({ charges: [] });
      }

      // Filtrer par property_id si spécifié et vérifié
      if (propertyId) {
        if (!propertyIds.includes(propertyId)) {
          return NextResponse.json({ error: "Accès non autorisé à cette propriété" }, { status: 403 });
        }
        const { data, error } = await supabase
          .from("charges")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ charges: data });
      }

      // Sinon retourner toutes les charges des propriétés de l'owner
      const { data, error } = await supabase
        .from("charges")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ charges: data });
    }

    // Pour les tenants: seulement les charges liées à leurs baux actifs
    if (profile.role === "tenant" || profile.role === "locataire") {
      const { data: leaseSigners } = await supabase
        .from("lease_signers")
        .select("leases!inner(property_id)")
        .eq("profile_id", profile.id);

      const tenantPropertyIds = leaseSigners?.map((ls: any) => ls.leases?.property_id).filter(Boolean) || [];

      if (tenantPropertyIds.length === 0) {
        return NextResponse.json({ charges: [] });
      }

      if (propertyId && !tenantPropertyIds.includes(propertyId)) {
        return NextResponse.json({ error: "Accès non autorisé à cette propriété" }, { status: 403 });
      }

      const filterIds = propertyId ? [propertyId] : tenantPropertyIds;
      const { data, error } = await supabase
        .from("charges")
        .select("*")
        .in("property_id", filterIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ charges: data });
    }

    // Rôle non reconnu
    return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

const postHandler = async (request: Request) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Seuls les owners et admins peuvent créer des charges
    if (profile.role !== "owner" && profile.role !== "proprietaire" && profile.role !== "admin") {
      return NextResponse.json({ error: "Non autorisé à créer des charges" }, { status: 403 });
    }

    const body = await request.json();
    const validated = chargeSchema.parse(body);

    // Vérifier que l'utilisateur est owner de la propriété (sauf admin)
    if (profile.role !== "admin") {
      const { data: property } = await supabase
        .from("properties")
        .select("id, owner_id")
        .eq("id", validated.property_id)
        .single();

      if (!property) {
        return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
      }

      if (property.owner_id !== profile.id) {
        return NextResponse.json({ error: "Vous n'êtes pas propriétaire de ce bien" }, { status: 403 });
      }
    }

    const { data: charge, error } = await supabase
      .from("charges")
      .insert({
        ...validated,
        created_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ charge }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

export const GET = withApiSecurity(getHandler, securityPresets.authenticated);
export const POST = withApiSecurity(postHandler, securityPresets.authenticated);
