/**
 * /api/tickets/** — Famille **API interne UI**.
 *
 * Routes consommées par l'application Talok elle-même (UI propriétaire,
 * locataire, prestataire, syndic) via `features/tickets/services/tickets.service.ts`
 * et l'app router pages.
 *
 * Caractéristiques :
 * - **Aucun feature gating de plan** : accessibles à tous les owners (gratuit → enterprise),
 *   parce qu'on ne peut pas refuser à un owner Free de gérer ses propres tickets.
 * - Auth cookie (Supabase session) requise.
 * - Lecture/écriture via `getServiceClient()` (service-role) après vérification métier
 *   explicite (creator / owner / assignee / admin) — voir commit 7518520 (PR #499).
 *
 * Pour exposer ces opérations en **API publique** (clients externes), utiliser
 * la famille `/api/v1/tickets/**` qui ajoute `requireApiAccess` (Pro+ requis).
 *
 * Ne pas fusionner les deux familles tant que ce gating est intentionnel.
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { ticketSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { createClient } from "@supabase/supabase-js";
import type { TicketRow } from "@/lib/supabase/typed-client";
import { ticketsQuerySchema, validateQueryParams } from "@/lib/validations/params";
import { withSecurity } from "@/lib/api/with-security";
import { createTicket } from "@/lib/tickets/create-ticket.service";

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
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
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
  } catch (error: unknown) {
    console.error("[GET /api/tickets] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

import { maintenanceAiService } from "@/features/tickets/services/maintenance-ai.service";

/**
 * POST /api/tickets - Créer un nouveau ticket
 * FIX AUDIT: Wrappé avec withSecurity (CSRF + error handling centralisé)
 */
export const POST = withSecurity(async function POST(request: Request) {
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
      .select("id, role, email")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé", code: "NO_PROFILE" },
        { status: 404 }
      );
    }

    const profileData = profile as { id: string; role: string; email: string | null };

    // Délégation au service partagé (source unique pour la création ticket).
    const result = await createTicket({
      serviceClient,
      auth: {
        user_id: user.id,
        user_email: user.email ?? null,
        profile_id: profileData.id,
        profile_email: profileData.email,
        profile_role: profileData.role,
      },
      input: validated,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      );
    }

    // AI Analysis (fire-and-forget, non-blocking)
    void (async () => {
      try {
        await maintenanceAiService.analyzeAndEnrichTicket(result.ticket.id);
      } catch (aiError) {
        console.error("AI Maintenance analysis failed:", aiError);
      }
    })();

    return NextResponse.json({ ticket: result.ticket });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}, { routeName: "POST /api/tickets", csrf: true });

