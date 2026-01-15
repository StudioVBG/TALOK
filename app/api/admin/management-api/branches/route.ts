export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour gérer les branches de base de données
 * 
 * GET /api/admin/management-api/branches?ref=<project_ref>
 * - Liste toutes les branches d'un projet
 * 
 * POST /api/admin/management-api/branches
 * - Crée une nouvelle branche
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createManagementClient } from "@/lib/supabase/management-api";
import type { CreateBranchRequest } from "@/lib/supabase/management-api/types";

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
    const branches = await client.listBranches(projectRef);

    return NextResponse.json({ branches, count: branches.length });
  } catch (err: any) {
    console.error("Erreur lors de la récupération des branches:", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la récupération des branches" },
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
    const { project_ref, ...branchData }: { project_ref: string } & CreateBranchRequest = body;

    if (!project_ref) {
      return NextResponse.json(
        { error: "Le champ 'project_ref' est requis" },
        { status: 400 }
      );
    }

    if (!branchData.branch_name) {
      return NextResponse.json(
        { error: "Le champ 'branch_name' est requis" },
        { status: 400 }
      );
    }

    const client = createManagementClient();
    const branch = await client.createBranch(project_ref, branchData);

    return NextResponse.json({ branch }, { status: 201 });
  } catch (err: any) {
    console.error("Erreur lors de la création de la branche:", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la création de la branche" },
      { status: 500 }
    );
  }
}

