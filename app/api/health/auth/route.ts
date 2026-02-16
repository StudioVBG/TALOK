export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

interface SyncReport {
  timestamp: string;
  status: "healthy" | "degraded" | "critical";
  score: number;
  maxScore: number;
  checks: {
    authWithoutProfile: { count: number; status: "pass" | "fail" };
    profilesWithoutEmail: { count: number; status: "pass" | "fail" };
    orphanProfiles: { count: number; status: "pass" | "warn" };
    desyncEmails: { count: number; status: "pass" | "warn" };
    triggerExists: { exists: boolean; status: "pass" | "fail" };
    insertPolicyExists: { exists: boolean; status: "pass" | "fail" };
  };
  totals: {
    authUsers: number;
    profiles: number;
  };
  roleDistribution: Record<string, number>;
}

/**
 * GET /api/health/auth — Rapport de sante de la synchronisation auth / profiles
 *
 * Necessite une authentification admin.
 * Retourne un rapport JSON complet avec score de sante.
 */
export async function GET(request: Request) {
  const { error, supabase } = await requireAdmin(request);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: (error as any).status || 401 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Erreur interne: client Supabase non disponible" },
      { status: 500 }
    );
  }

  try {
    const report = await buildSyncReport(supabase);
    const httpStatus = report.status === "critical" ? 503 : 200;
    return NextResponse.json(report, { status: httpStatus });
  } catch (err) {
    console.error("[GET /api/health/auth] Erreur:", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation du rapport de sante" },
      { status: 500 }
    );
  }
}

async function buildSyncReport(supabase: any): Promise<SyncReport> {
  let score = 0;
  const maxScore = 6;

  // 1. Auth users sans profil
  const { data: orphanAuth, error: orphanAuthErr } = await supabase.rpc(
    "check_auth_without_profile"
  );
  let authWithoutProfileCount = 0;
  let authWithoutProfileStatus: "pass" | "fail" = "pass";

  if (!orphanAuthErr && orphanAuth !== null) {
    authWithoutProfileCount = Number(orphanAuth);
  } else {
    const { count } = await supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true });
    const { data: authCount } = await supabase.rpc("count_auth_users");
    const totalAuth = authCount ?? 0;
    const totalProfiles = count ?? 0;
    authWithoutProfileCount = Math.max(0, totalAuth - totalProfiles);
  }

  if (authWithoutProfileCount === 0) {
    authWithoutProfileStatus = "pass";
    score++;
  } else {
    authWithoutProfileStatus = "fail";
  }

  // 2. Profils sans email
  const { count: nullEmailCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .or("email.is.null,email.eq.");

  const profilesWithoutEmailCount = nullEmailCount ?? 0;
  const profilesWithoutEmailStatus: "pass" | "fail" =
    profilesWithoutEmailCount === 0 ? "pass" : "fail";
  if (profilesWithoutEmailStatus === "pass") score++;

  // 3. Total profiles
  const { count: totalProfilesCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // 4. Profils orphelins (sans auth.users)
  const { data: orphanProfilesData } = await supabase.rpc(
    "check_orphan_profiles"
  );
  const orphanProfilesCount = orphanProfilesData
    ? Number(orphanProfilesData)
    : 0;
  let orphanProfilesStatus: "pass" | "warn" = "pass";
  if (orphanProfilesCount === 0) {
    score++;
  } else {
    orphanProfilesStatus = "warn";
  }

  // 5. Emails desynchronises
  const { data: desyncData } = await supabase.rpc("check_desync_emails");
  const desyncEmailsCount = desyncData ? Number(desyncData) : 0;
  let desyncEmailsStatus: "pass" | "warn" = "pass";
  if (desyncEmailsCount === 0) {
    score++;
  } else {
    desyncEmailsStatus = "warn";
  }

  // 6. Trigger exists
  const { data: triggerData } = await supabase.rpc("check_trigger_exists", {
    p_trigger_name: "on_auth_user_created",
  });
  const triggerExistsVal = !!triggerData;
  const triggerExistsStatus: "pass" | "fail" = triggerExistsVal
    ? "pass"
    : "fail";
  if (triggerExistsVal) score++;

  // 7. INSERT policy exists
  const { data: policyData } = await supabase.rpc(
    "check_insert_policy_exists",
    { p_table_name: "profiles" }
  );
  const insertPolicyExistsVal = !!policyData;
  const insertPolicyExistsStatus: "pass" | "fail" = insertPolicyExistsVal
    ? "pass"
    : "fail";
  if (insertPolicyExistsVal) score++;

  // 8. Distribution des roles
  const { data: allProfiles } = await supabase.from("profiles").select("role");
  const roleDistribution: Record<string, number> = {};
  if (allProfiles) {
    for (const row of allProfiles as { role: string }[]) {
      roleDistribution[row.role] = (roleDistribution[row.role] || 0) + 1;
    }
  }

  // 9. Total auth users
  const { data: authUsersCount } = await supabase.rpc("count_auth_users");

  // Status global
  let status: "healthy" | "degraded" | "critical";
  if (score === maxScore) {
    status = "healthy";
  } else if (score >= 4) {
    status = "degraded";
  } else {
    status = "critical";
  }

  return {
    timestamp: new Date().toISOString(),
    status,
    score,
    maxScore,
    checks: {
      authWithoutProfile: {
        count: authWithoutProfileCount,
        status: authWithoutProfileStatus,
      },
      profilesWithoutEmail: {
        count: profilesWithoutEmailCount,
        status: profilesWithoutEmailStatus,
      },
      orphanProfiles: {
        count: orphanProfilesCount,
        status: orphanProfilesStatus,
      },
      desyncEmails: {
        count: desyncEmailsCount,
        status: desyncEmailsStatus,
      },
      triggerExists: {
        exists: triggerExistsVal,
        status: triggerExistsStatus,
      },
      insertPolicyExists: {
        exists: insertPolicyExistsVal,
        status: insertPolicyExistsStatus,
      },
    },
    totals: {
      authUsers: authUsersCount ?? 0,
      profiles: totalProfilesCount ?? 0,
    },
    roleDistribution,
  };
}
