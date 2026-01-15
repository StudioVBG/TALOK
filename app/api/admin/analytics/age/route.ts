export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

const roleQuerySchema = z.enum(["owner", "tenant"]).optional();

/**
 * GET /api/admin/analytics/age - Analytics d'âge par rôle
 * 
 * Query params:
 * - role: "owner" | "tenant" (optionnel, retourne les deux si non spécifié)
 */
export async function GET(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const role = roleParam ? roleQuerySchema.parse(roleParam) : undefined;

    // Fonction helper pour calculer l'âge moyen d'une tranche
    function getMidAge(bucket: string): number | null {
      if (bucket === "unknown" || bucket === "<18") return null;
      const match = bucket.match(/(\d+)-(\d+)/);
      if (match) {
        return (parseInt(match[1]) + parseInt(match[2])) / 2;
      }
      if (bucket === "65+") return 70;
      return null;
    }

    // Récupérer les données depuis la vue
    let query = supabase
      .from("v_portfolio_age_buckets")
      .select("*");

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      throw new ApiError(500, "Erreur lors de la récupération des analytics", queryError);
    }

    // Grouper par rôle et transformer les données
    const result: Record<string, {
      role: string;
      buckets: Array<{ bucket: string; count: number }>;
      avg?: number;
      total: number;
    }> = {};

    (data || []).forEach((row: any) => {
      const roleKey = row.role;
      if (!result[roleKey]) {
        result[roleKey] = {
          role: roleKey,
          buckets: [],
          total: 0,
        };
      }

      result[roleKey].buckets.push({
        bucket: row.bucket,
        count: row.persons,
      });
      result[roleKey].total += row.persons;
    });

    // Calculer les moyennes pour chaque rôle
    Object.keys(result).forEach((roleKey) => {
      const roleData = result[roleKey];
      const total = roleData.total;
      
      if (total > 0 && roleData.buckets.length > 0) {
        const avg = roleData.buckets.reduce((sum, b) => {
          const midAge = getMidAge(b.bucket);
          return sum + (midAge || 0) * b.count;
        }, 0) / total;
        
        roleData.avg = Math.round(avg);
      }
    });

    // Si un rôle spécifique est demandé, retourner uniquement ce rôle
    if (role && result[role]) {
      return NextResponse.json(result[role]);
    }

    // Sinon, retourner tous les rôles
    return NextResponse.json({
      analytics: Object.values(result),
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

