export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET ou POST /api/cron/providers-revalidate-insee
 *
 * Cron mensuel : revalide auprès de l'INSEE l'identité légale des
 * prestataires inscrits sur la plateforme.
 *
 * Logique :
 *   - Cible les `providers` qui ont un SIRET et dont `api_resolved_at`
 *     est NULL ou plus vieux que 30 jours
 *   - Pour chaque ligne, appelle l'API Recherche d'entreprises
 *   - Met à jour les colonnes légales et `api_resolved_at`
 *   - Si l'INSEE renvoie `etat_administratif = 'C'` (cessation) :
 *       → passe `status = 'suspended'`
 *       → loggue dans `cron_logs` pour qu'un admin puisse réagir
 *   - Limite de débit : 200 ms entre appels (≈ 5 req/s, < limite publique 7/s)
 *   - Plafond : 100 SIRET par run pour borner la durée
 *
 * Auth : Authorization: Bearer <CRON_SECRET> (en production)
 *
 * Query params :
 *   ?dry_run=true  → simulation sans écriture
 *   ?limit=N       → cap personnalisé (défaut 100)
 */

import { NextResponse } from "next/server";
import { lookupBySiret } from "@/lib/siret/recherche-entreprises";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const DEFAULT_LIMIT = 100;
const RATE_LIMIT_MS = 200;
const REVALIDATE_AFTER_DAYS = 30;

interface RunSummary {
  scanned: number;
  refreshed: number;
  suspended: number;
  not_found: number;
  api_errors: number;
  invalid: number;
  duration_ms: number;
  ceased_provider_ids: string[];
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const startedAt = Date.now();
  const summary: RunSummary = {
    scanned: 0,
    refreshed: 0,
    suspended: 0,
    not_found: 0,
    api_errors: 0,
    invalid: 0,
    duration_ms: 0,
    ceased_provider_ids: [],
  };

  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dry_run") === "true";
    const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 500);

    const supabase = createServiceRoleClient();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REVALIDATE_AFTER_DAYS);
    const cutoffIso = cutoff.toISOString();

    // Cible : providers avec siret + (jamais résolus OU résolus il y a > 30j)
    // On exclut les déjà 'archived' (utilisateur a quitté, pas la peine).
    const { data: providers, error } = await supabase
      .from("providers")
      .select("id, siret, status, api_resolved_at, etat_administratif")
      .not("siret", "is", null)
      .neq("status", "archived")
      .or(`api_resolved_at.is.null,api_resolved_at.lt.${cutoffIso}`)
      .order("api_resolved_at", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new Error(`Lecture providers: ${error.message}`);
    }

    summary.scanned = providers?.length ?? 0;

    for (const p of providers ?? []) {
      const id = typeof p.id === "string" ? p.id : null;
      const siret = typeof p.siret === "string" ? p.siret : null;
      if (!id || !siret) continue;
      // Rate limit (ne pas saturer l'API publique)
      if (summary.scanned > 1) {
        await sleep(RATE_LIMIT_MS);
      }

      const result = await lookupBySiret(siret);

      if (!result.ok) {
        if (result.reason === "invalid_siret") {
          summary.invalid += 1;
        } else if (result.reason === "not_found") {
          summary.not_found += 1;
        } else if (result.reason === "ceased") {
          // Cessé côté INSEE : on suspend le compte
          summary.suspended += 1;
          summary.ceased_provider_ids.push(id);
          if (!dryRun) {
            await supabase
              .from("providers")
              .update({
                status: "suspended",
                etat_administratif: "C",
                api_resolved_at: new Date().toISOString(),
                api_source: "recherche-entreprises.api.gouv.fr",
              })
              .eq("id", id);
          }
        } else {
          summary.api_errors += 1;
        }
        continue;
      }

      const data = result.data;
      summary.refreshed += 1;

      if (!dryRun) {
        const updates: Record<string, unknown> = {
          forme_juridique: data.forme_juridique,
          nature_juridique_code: data.nature_juridique_code,
          capital_social: data.capital_social,
          date_creation: data.date_creation,
          rcs_numero: data.rcs_numero,
          rcs_ville: data.rcs_ville,
          tva_intra: data.tva_intra,
          naf_code: data.naf_code,
          naf_label: data.naf_label,
          dirigeant_nom: data.dirigeant_nom,
          dirigeant_prenom: data.dirigeant_prenom,
          dirigeant_qualite: data.dirigeant_qualite,
          est_rge: data.est_rge,
          etat_administratif: data.etat_administratif,
          api_source: "recherche-entreprises.api.gouv.fr",
          api_resolved_at: new Date().toISOString(),
          address: data.adresse,
          postal_code: data.code_postal,
          city: data.ville,
        };
        const { error: updErr } = await supabase.from("providers").update(updates).eq("id", id);
        if (updErr) {
          summary.api_errors += 1;
          summary.refreshed -= 1;
        }
      }
    }

    summary.duration_ms = Date.now() - startedAt;

    if (!dryRun) {
      await logCronRun(supabase, "providers-revalidate-insee", "success", summary);
    }

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      summary,
    });
  } catch (err) {
    summary.duration_ms = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    try {
      const supabase = createServiceRoleClient();
      await logCronRun(supabase, "providers-revalidate-insee", "error", summary, message);
    } catch {
      // Si même le logging échoue, on n'a pas grand-chose à faire.
    }
    return NextResponse.json({ ok: false, error: message, summary }, { status: 500 });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logCronRun(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cronName: string,
  status: "success" | "error",
  summary: RunSummary,
  errorMessage?: string,
) {
  // `cron_logs` n'est pas encore reflété dans les types Supabase générés —
  // on relaxe le typage le temps que `supabase gen types` soit relancé.
  const client = supabase as unknown as {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<unknown>;
    };
  };
  await client.from("cron_logs").insert({
    cron_name: cronName,
    status,
    started_at: new Date(Date.now() - summary.duration_ms).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: summary.duration_ms,
    result: summary,
    error_message: errorMessage ?? null,
  });
}
