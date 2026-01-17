export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Export RGPD - Article 20 (Droit à la portabilité)
 * 
 * Permet à un utilisateur d'exporter toutes ses données personnelles
 * au format JSON structuré.
 * 
 * GET /api/privacy/export - Export ses propres données
 * GET /api/privacy/export?user_id=xxx - Export données d'un utilisateur (admin only)
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ExportData {
  export_date: string;
  export_version: string;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
  profile: any;
  role_profile: any;
  consents: any;
  properties: any[];
  leases: any[];
  invoices: any[];
  payments: any[];
  documents: any[];
  tickets: any[];
  notifications: any[];
  audit_logs: any[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("user_id");
    
    // Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Déterminer l'utilisateur cible
    let userId = user.id;
    
    // Si un user_id est spécifié, vérifier les droits admin
    if (targetUserId && targetUserId !== user.id) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      if ((adminProfile as any)?.role !== "admin") {
        return NextResponse.json(
          { error: "Seul l'admin peut exporter les données d'un autre utilisateur" },
          { status: 403 }
        );
      }
      userId = targetUserId;
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const profileId = (profile as any).id;
    const role = (profile as any).role;

    // Initialiser l'export
    const exportData: ExportData = {
      export_date: new Date().toISOString(),
      export_version: "1.0",
      user: {
        id: userId,
        email: (profile as any).email || user.email || "",
        created_at: (profile as any).created_at,
      },
      profile: sanitizeProfile(profile),
      role_profile: null,
      consents: null,
      properties: [],
      leases: [],
      invoices: [],
      payments: [],
      documents: [],
      tickets: [],
      notifications: [],
      audit_logs: [],
    };

    // Récupérer le profil spécifique au rôle
    if (role === "owner") {
      const { data: ownerProfile } = await supabase
        .from("owner_profiles")
        .select("*")
        .eq("profile_id", profileId)
        .single();
      exportData.role_profile = ownerProfile;
    } else if (role === "tenant") {
      const { data: tenantProfile } = await supabase
        .from("tenant_profiles")
        .select("*")
        .eq("profile_id", profileId)
        .single();
      exportData.role_profile = tenantProfile;
    } else if (role === "provider") {
      const { data: providerProfile } = await supabase
        .from("provider_profiles")
        .select("*")
        .eq("profile_id", profileId)
        .single();
      exportData.role_profile = providerProfile;
    }

    // Récupérer les consentements
    const { data: consents } = await supabase
      .from("user_consents")
      .select("*")
      .eq("user_id", userId)
      .single();
    exportData.consents = consents;

    // Récupérer les propriétés (si owner)
    if (role === "owner") {
      const { data: properties } = await supabase
        .from("properties")
        .select(`
          *,
          units (*),
          property_photos (*),
          property_rooms (*)
        `)
        .eq("owner_id", profileId);
      exportData.properties = (properties || []).map(sanitizeProperty);
    }

    // Récupérer les baux
    const { data: leases } = await supabase
      .from("leases")
      .select(`
        *,
        lease_signers (*)
      `)
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
    exportData.leases = leases || [];

    // Récupérer les factures
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
    exportData.invoices = invoices || [];

    // Récupérer les paiements
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map((i: any) => i.id);
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .in("invoice_id", invoiceIds);
      exportData.payments = payments || [];
    }

    // Récupérer les documents
    const { data: documents } = await supabase
      .from("documents")
      .select("id, type, filename, created_at, metadata")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
    exportData.documents = documents || [];

    // Récupérer les tickets
    const { data: tickets } = await supabase
      .from("tickets")
      .select(`
        *,
        ticket_messages (*)
      `)
      .eq("created_by_profile_id", profileId);
    exportData.tickets = tickets || [];

    // Récupérer les notifications (derniers 6 mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profileId)
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    exportData.notifications = notifications || [];

    // Récupérer les logs d'audit (dernière année)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data: auditLogs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", oneYearAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);
    exportData.audit_logs = auditLogs || [];

    // Logger l'export dans audit_log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "data_exported",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        export_by: user.id,
        export_for: userId,
        sections: Object.keys(exportData).filter(k => {
          const val = (exportData as any)[k];
          return val !== null && (!Array.isArray(val) || val.length > 0);
        }),
      },
    } as any);

    // Retourner le fichier JSON
    const jsonContent = JSON.stringify(exportData, null, 2);
    
    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="export-rgpd-${userId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: unknown) {
    console.error("[privacy/export] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Sanitize le profil pour l'export (retirer les champs sensibles internes)
 */
function sanitizeProfile(profile: any): any {
  if (!profile) return null;
  
  const { 
    // Garder ces champs
    id, user_id, role, prenom, nom, email, telephone,
    avatar_url, date_naissance, created_at, updated_at,
    ...rest 
  } = profile;
  
  return {
    id,
    user_id,
    role,
    prenom,
    nom,
    email,
    telephone,
    avatar_url,
    date_naissance,
    created_at,
    updated_at,
  };
}

/**
 * Sanitize une propriété pour l'export
 */
function sanitizeProperty(property: any): any {
  if (!property) return null;
  
  // Retirer les données de géolocalisation précises si sensibles
  const { 
    latitude, longitude, // Retirer coordonnées exactes
    ...rest 
  } = property;
  
  return {
    ...rest,
    // Garder seulement ville/code postal pour la localisation
    location_summary: property.ville ? `${property.code_postal} ${property.ville}` : null,
  };
}

