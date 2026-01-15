export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour gérer les projets Supabase via l'API Management
 * 
 * GET /api/admin/management-api/projects
 * - Liste tous les projets accessibles via le PAT
 * 
 * GET /api/admin/management-api/projects?ref=<project_ref>
 * - Récupère les détails d'un projet spécifique
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createManagementClient } from "@/lib/supabase/management-api";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAdmin(request);

  if (error || !user) {
    return NextResponse.json(
      { error: "Non autorisé. Accès admin requis." },
      { status: 401 }
    );
  }

  try {
    const client = createManagementClient();
    const searchParams = request.nextUrl.searchParams;
    const projectRef = searchParams.get("ref");

    if (projectRef) {
      // Récupérer un projet spécifique
      const project = await client.getProject(projectRef);
      return NextResponse.json({ project });
    }

    // Lister tous les projets
    const projects = await client.listProjects();
    return NextResponse.json({ projects, count: projects.length });
  } catch (err: any) {
    console.error("Erreur lors de la récupération des projets:", err);

    // Gérer les erreurs spécifiques
    if (err.message.includes("SUPABASE_MANAGEMENT_API_TOKEN")) {
      return NextResponse.json(
        {
          error: "Token Management API non configuré",
          details:
            "Configurez SUPABASE_MANAGEMENT_API_TOKEN dans vos variables d'environnement",
        },
        { status: 500 }
      );
    }

    if (err.message.includes("401") || err.message.includes("403")) {
      return NextResponse.json(
        { error: "Token Management API invalide ou expiré" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Erreur lors de la récupération des projets" },
      { status: 500 }
    );
  }
}

