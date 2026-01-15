export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour gérer les secrets d'un projet
 * 
 * GET /api/admin/management-api/secrets?ref=<project_ref>
 * - Liste tous les secrets d'un projet
 * 
 * POST /api/admin/management-api/secrets
 * - Crée ou met à jour des secrets
 * 
 * DELETE /api/admin/management-api/secrets
 * - Supprime des secrets
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
    const searchParams = request.nextUrl.searchParams;
    const projectRef = searchParams.get("ref");

    if (!projectRef) {
      return NextResponse.json(
        { error: "Le paramètre 'ref' est requis" },
        { status: 400 }
      );
    }

    const client = createManagementClient();
    const secrets = await client.listSecrets(projectRef);

    // Ne pas exposer les valeurs des secrets dans la réponse
    const secretsWithoutValues = secrets.map(({ name, updated_at }) => ({
      name,
      updated_at,
    }));

    return NextResponse.json({
      secrets: secretsWithoutValues,
      count: secrets.length,
    });
  } catch (err: any) {
    console.error("Erreur lors de la récupération des secrets:", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la récupération des secrets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin(request);

  if (error || !user) {
    return NextResponse.json(
      { error: "Non autorisé. Accès admin requis." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { project_ref, secrets }: { project_ref: string; secrets: Array<{ name: string; value: string }> } = body;

    if (!project_ref) {
      return NextResponse.json(
        { error: "Le champ 'project_ref' est requis" },
        { status: 400 }
      );
    }

    if (!Array.isArray(secrets) || secrets.length === 0) {
      return NextResponse.json(
        { error: "Le champ 'secrets' doit être un tableau non vide" },
        { status: 400 }
      );
    }

    // Valider que chaque secret a un nom et une valeur
    for (const secret of secrets) {
      if (!secret.name || !secret.value) {
        return NextResponse.json(
          { error: "Chaque secret doit avoir un 'name' et une 'value'" },
          { status: 400 }
        );
      }
    }

    const client = createManagementClient();
    await client.createSecrets(project_ref, secrets);

    return NextResponse.json(
      { message: `${secrets.length} secret(s) créé(s) avec succès` },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Erreur lors de la création des secrets:", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la création des secrets" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await requireAdmin(request);

  if (error || !user) {
    return NextResponse.json(
      { error: "Non autorisé. Accès admin requis." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { project_ref, secret_names }: { project_ref: string; secret_names: string[] } = body;

    if (!project_ref) {
      return NextResponse.json(
        { error: "Le champ 'project_ref' est requis" },
        { status: 400 }
      );
    }

    if (!Array.isArray(secret_names) || secret_names.length === 0) {
      return NextResponse.json(
        { error: "Le champ 'secret_names' doit être un tableau non vide" },
        { status: 400 }
      );
    }

    const client = createManagementClient();
    await client.deleteSecrets(project_ref, secret_names);

    return NextResponse.json({
      message: `${secret_names.length} secret(s) supprimé(s) avec succès`,
    });
  } catch (err: any) {
    console.error("Erreur lors de la suppression des secrets:", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la suppression des secrets" },
      { status: 500 }
    );
  }
}

