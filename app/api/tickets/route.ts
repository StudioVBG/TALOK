export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { ticketSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { createClient } from "@supabase/supabase-js";
import type { ProfileRow, TicketRow } from "@/lib/supabase/typed-client";
import { ticketsQuerySchema, validateQueryParams } from "@/lib/validations/params";

/**
 * GET /api/tickets - Récupérer les tickets de l'utilisateur
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // ✅ VALIDATION: Valider les query params
    const url = new URL(request.url);
    let queryParams;
    try {
      queryParams = validateQueryParams(ticketsQuerySchema, url.searchParams);
    } catch (validationError) {
      console.warn("[GET /api/tickets] Invalid query params, using defaults:", validationError);
      queryParams = {};
    }

    // ✅ PAGINATION: Récupérer les paramètres de pagination
    const page = parseInt(String(queryParams.page || "1"));
    const limit = Math.min(parseInt(String(queryParams.limit || "50")), 200); // Max 200
    const offset = (page - 1) * limit;

    // Utiliser le service client pour éviter les problèmes RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY manquante" },
        { status: 500 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Récupérer le profil avec service client
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Récupérer les tickets selon le rôle avec service client, pagination et filtres
    let tickets: TicketRow[] | undefined;
    let totalCount: number | null = null;
    let baseQuery;
    
    if (profileData.role === "admin") {
      // Les admins voient tous les tickets
      baseQuery = serviceClient
        .from("tickets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
    } else if (profileData.role === "owner") {
      // Les propriétaires voient les tickets de leurs propriétés
      const { data: properties, error: propertiesError } = await serviceClient
        .from("properties")
        .select("id")
        .eq("owner_id", profileData.id);

      if (propertiesError) throw propertiesError;
      if (!properties || properties.length === 0) {
        tickets = [];
        baseQuery = null;
      } else {
        const propertyIds = properties.map((p) => p.id);
        baseQuery = serviceClient
          .from("tickets")
          .select("*", { count: "exact" })
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false });
      }
    } else if (profileData.role === "tenant") {
      // Les locataires voient les tickets de leurs baux ou créés par eux
      const { data: signers, error: signersError } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", profileData.id)
        .in("role", ["locataire_principal", "colocataire"]);

      if (signersError) throw signersError;
      if (!signers || signers.length === 0) {
        // Pas de baux, seulement les tickets créés par le locataire
        baseQuery = serviceClient
          .from("tickets")
          .select("*", { count: "exact" })
          .eq("created_by_profile_id", profileData.id)
          .order("created_at", { ascending: false });
      } else {
        const leaseIds = signers.map((s) => s.lease_id);
        baseQuery = serviceClient
          .from("tickets")
          .select("*", { count: "exact" })
          .or(`lease_id.in.(${leaseIds.join(",")}),created_by_profile_id.eq.${profileData.id}`)
          .order("created_at", { ascending: false });
      }
    } else {
      tickets = [];
      baseQuery = null;
    }

    // ✅ FILTRES: Appliquer les filtres si fournis
    if (baseQuery) {
      if (queryParams.property_id || queryParams.propertyId) {
        baseQuery = baseQuery.eq("property_id", queryParams.property_id || queryParams.propertyId);
      }
      if (queryParams.lease_id || queryParams.leaseId) {
        baseQuery = baseQuery.eq("lease_id", queryParams.lease_id || queryParams.leaseId);
      }
      if (queryParams.status) {
        baseQuery = baseQuery.eq("statut", queryParams.status);
      }
      if (queryParams.priority) {
        baseQuery = baseQuery.eq("priorite", queryParams.priority);
      }

      // ✅ PAGINATION: Appliquer la pagination
      const { data, error, count } = await baseQuery.range(offset, offset + limit - 1);

      if (error) throw error;
      tickets = data ? (data as TicketRow[]) : undefined;
      totalCount = count;
    }

    // Ajouter des headers de cache pour réduire la charge CPU
    return NextResponse.json(
      { 
        tickets: tickets || [],
        pagination: {
          page,
          limit,
          total: totalCount || tickets?.length || 0,
        }
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error("[GET /api/tickets] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

import { maintenanceAiService } from "@/features/tickets/services/maintenance-ai.service";
import { sendNewTicketNotification } from "@/lib/emails";

/**
 * POST /api/tickets - Créer un nouveau ticket
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message, details: (authError as any).details },
        { status: authError.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = ticketSchema.parse(body);

    // Utiliser le service client pour éviter les problèmes RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY manquante" },
        { status: 500 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Récupérer le profil avec service client
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Créer le ticket avec service client
    const { data: ticket, error: insertError } = await serviceClient
      .from("tickets")
      .insert({
        ...validated,
        created_by_profile_id: profileData.id,
        statut: "open",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "Ticket.Opened",
      payload: {
        ticket_id: ticket.id,
        property_id: validated.property_id,
        priority: validated.priorite,
      },
    } as any);

    // AI Analysis Trigger (Async but awaited here for serverless environment safety)
    try {
        // En background job idéalement, mais ici on l'exécute
        await maintenanceAiService.analyzeAndEnrichTicket(ticket.id);
    } catch (aiError) {
        console.error("AI Maintenance analysis failed:", aiError);
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "ticket_created",
      entity_type: "ticket",
      entity_id: ticket.id,
      metadata: { priority: validated.priorite },
    } as any);

    // Envoyer l'email de notification au propriétaire
    try {
      // Récupérer les infos du propriétaire et de la propriété
      const { data: property } = await serviceClient
        .from("properties")
        .select(`
          owner_id,
          adresse_complete,
          owner:profiles!properties_owner_id_fkey(
            id, prenom, nom, user_id
          )
        `)
        .eq("id", validated.property_id)
        .single();

      if (property?.owner) {
        // Récupérer l'email du propriétaire
        const { data: ownerAuth } = await serviceClient.auth.admin.getUserById(
          (property.owner as any).user_id
        );

        if (ownerAuth?.user?.email) {
          const creatorName = `${profileData.prenom || ""} ${profileData.nom || ""}`.trim() || "Un utilisateur";

          await sendNewTicketNotification({
            recipientEmail: ownerAuth.user.email,
            recipientName: `${(property.owner as any).prenom || ""} ${(property.owner as any).nom || ""}`.trim() || "Propriétaire",
            ticketTitle: validated.titre,
            ticketDescription: validated.description || "Aucune description",
            priority: validated.priorite as "basse" | "normale" | "haute",
            propertyAddress: property.adresse_complete || "Adresse non spécifiée",
            createdBy: creatorName,
            ticketId: ticket.id,
          });
          console.log(`[tickets] Email de nouveau ticket envoyé au propriétaire ${ownerAuth.user.email}`);
        }
      }
    } catch (emailError) {
      // Ne pas bloquer la création si l'email échoue
      console.error("[tickets] Erreur envoi email nouveau ticket:", emailError);
    }

    return NextResponse.json({ ticket });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

