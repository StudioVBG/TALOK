#!/usr/bin/env tsx
/**
 * Script d'audit des connexions entre comptes propriétaire / locataire
 *
 * Analyse :
 * - Comptes auth.users et profiles
 * - lease_signers orphelins (profile_id NULL alors qu'un compte existe)
 * - Invitations non marquées comme utilisées
 * - Notifications manquantes pour le propriétaire
 *
 * Usage: npx tsx scripts/audit-account-connections.ts [--email=xxx]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Types pour l'audit
interface OrphanSigner {
  id: string;
  lease_id: string;
  invited_email: string | null;
  role: string;
  statut?: string;
}

interface EmailToProfile {
  email: string;
  user_id: string;
  profile_id: string;
  role: string;
}

interface InvitationRow {
  id: string;
  email: string;
  lease_id: string | null;
  used_at: string | null;
  used_by: string | null;
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

function logSection(title: string) {
  console.log("\n" + BLUE + "═══ " + title + " ═══" + RESET + "\n");
}

function logOk(msg: string) {
  console.log(GREEN + "✅ " + msg + RESET);
}

function logWarn(msg: string) {
  console.log(YELLOW + "⚠️  " + msg + RESET);
}

function logCritical(msg: string) {
  console.log(RED + "❌ " + msg + RESET);
}

/** Récupère les lease_signers orphelins (profile_id NULL, invited_email renseigné) */
async function findOrphanedSigners(filterEmail?: string): Promise<OrphanSigner[]> {
  let query = supabase
    .from("lease_signers")
    .select("id, lease_id, invited_email, role")
    .is("profile_id", null)
    .not("invited_email", "is", null);

  if (filterEmail) {
    query = query.ilike("invited_email", filterEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erreur lecture lease_signers:", error.message);
    return [];
  }

  const rows = (data ?? []) as OrphanSigner[];
  if (rows.length === 0) return rows;

  // Enrichir avec le statut du bail
  const leaseIds = [...new Set(rows.map((r) => r.lease_id))];
  const { data: leases } = await supabase
    .from("leases")
    .select("id, statut")
    .in("id", leaseIds);
  const leaseMap = new Map((leases ?? []).map((l: { id: string; statut: string }) => [l.id, l.statut]));

  return rows.map((r) => ({
    ...r,
    statut: leaseMap.get(r.lease_id),
  }));
}

/** Construit la map email (lowercase) -> profile (user_id, profile_id, role) via auth.users + profiles */
async function buildEmailToProfileMap(): Promise<Map<string, EmailToProfile>> {
  const map = new Map<string, EmailToProfile>();

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError || !users?.users?.length) {
    console.warn("Impossible de lister auth.users:", usersError?.message ?? "aucun utilisateur");
    return map;
  }

  const userIds = users.users.map((u) => u.id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .in("user_id", userIds);

  if (profilesError || !profiles?.length) return map;

  const profileByUserId = new Map(profiles.map((p: { user_id: string; id: string; role: string }) => [p.user_id, p]));

  for (const user of users.users) {
    const email = user.email?.trim();
    if (!email) continue;
    const profile = profileByUserId.get(user.id);
    if (!profile) continue;
    map.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      user_id: user.id,
      profile_id: profile.id,
      role: profile.role,
    });
  }
  return map;
}

/** Invitations dont l'email correspond et qui ne sont pas marquées utilisées */
async function findUnusedInvitationsForEmails(emails: string[]): Promise<InvitationRow[]> {
  if (emails.length === 0) return [];
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, lease_id, used_at, used_by")
    .is("used_at", null);
  if (error || !data) return [];
  const lower = new Set(emails.map((e) => e.toLowerCase()));
  return (data as InvitationRow[]).filter((inv) => inv.email && lower.has(String(inv.email).toLowerCase()));
}

/** Vérifie les notifications tenant_account_created pour les baux concernés */
async function countTenantAccountNotificationsForLeases(leaseIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (leaseIds.length === 0) return result;
  const { data, error } = await supabase
    .from("notifications")
    .select("metadata")
    .eq("type", "tenant_account_created");
  if (error || !data) return result;
  for (const leaseId of leaseIds) {
    const count = (data as { metadata?: { lease_id?: string } }[]).filter(
      (n) => (n.metadata as { lease_id?: string } | null)?.lease_id === leaseId
    ).length;
    result.set(leaseId, count);
  }
  return result;
}

function escapeSqlEmail(e: string): string {
  return "'" + String(e).replace(/'/g, "''") + "'";
}

/** Génère le SQL correctif pour lier les orphelins à un email donné */
function generateFixSqlLinkOrphans(emails: string[]): string {
  if (emails.length === 0) return "";
  const quoted = emails.map(escapeSqlEmail).join(", ");
  return (
    "-- Lier les profils locataires aux lease_signers orphelins\n" +
    "WITH tenant_profiles AS (\n" +
    "  SELECT p.id AS profile_id, LOWER(TRIM(u.email)) AS email\n" +
    "  FROM profiles p\n" +
    "  JOIN auth.users u ON u.id = p.user_id\n" +
    "  WHERE LOWER(TRIM(u.email)) IN (" +
    quoted +
    ")\n" +
    ")\n" +
    "UPDATE lease_signers ls\n" +
    "SET profile_id = tp.profile_id\n" +
    "FROM tenant_profiles tp\n" +
    "WHERE LOWER(TRIM(ls.invited_email)) = tp.email\n" +
    "  AND ls.profile_id IS NULL;\n"
  );
}

/** Génère le SQL pour marquer les invitations comme utilisées */
function generateFixSqlMarkInvitations(emails: string[]): string {
  if (emails.length === 0) return "";
  const quoted = emails.map(escapeSqlEmail).join(", ");
  return (
    "-- Marquer les invitations comme utilisées (used_by = profile du locataire)\n" +
    "WITH tenant_profiles AS (\n" +
    "  SELECT p.id AS profile_id, LOWER(TRIM(u.email)) AS email\n" +
    "  FROM profiles p\n" +
    "  JOIN auth.users u ON u.id = p.user_id\n" +
    "  WHERE LOWER(TRIM(u.email)) IN (" +
    quoted +
    ")\n" +
    ")\n" +
    "UPDATE invitations i\n" +
    "SET used_by = tp.profile_id, used_at = NOW()\n" +
    "FROM tenant_profiles tp\n" +
    "WHERE LOWER(TRIM(i.email)) = tp.email\n" +
    "  AND i.used_at IS NULL;\n"
  );
}

async function runAudit(filterEmail?: string) {
  console.log("\n" + BLUE + "═══════════════════════════════════════════════════════");
  console.log("  AUDIT CONNEXION COMPTES — Propriétaire / Locataire");
  console.log("═══════════════════════════════════════════════════════" + RESET + "\n");
  if (filterEmail) {
    console.log("\nFiltre email: " + filterEmail);
  }

  const emailToProfile = await buildEmailToProfileMap();
  logSection("1. Comptes auth.users ↔ profiles");
  console.log("   Emails avec compte (auth + profil): " + emailToProfile.size);

  const orphans = await findOrphanedSigners(filterEmail);
  logSection("2. Lease_signers orphelins (profile_id NULL)");
  if (orphans.length === 0) {
    logOk("Aucun signataire orphelin avec invited_email.");
    return;
  }
  logCritical(orphans.length + " signataire(s) orphelin(s) trouvé(s).");

  const orphanEmails = [...new Set(orphans.map((o) => (o.invited_email ?? "").toLowerCase().trim()).filter(Boolean))];
  const fixable: OrphanSigner[] = [];
  const unfixable: OrphanSigner[] = [];

  for (const o of orphans) {
    const email = (o.invited_email ?? "").toLowerCase().trim();
    const hasProfile = email && emailToProfile.has(email);
    if (hasProfile) fixable.push(o);
    else unfixable.push(o);
  }

  for (const o of orphans) {
    const email = (o.invited_email ?? "").trim();
    const hasProfile = email && emailToProfile.has(email.toLowerCase());
    const status = hasProfile ? GREEN + "✅ RUPTURE (corrigeable)" + RESET : YELLOW + "⚠️  Pas de compte pour cet email" + RESET;
    console.log("   - " + email + " | bail " + o.lease_id.slice(0, 8) + "... | rôle " + o.role + " | statut bail: " + (o.statut ?? "?") + " | " + status);
  }

  const unusedInvitations = await findUnusedInvitationsForEmails(orphanEmails);
  logSection("3. Invitations non marquées utilisées");
  if (unusedInvitations.length === 0 && orphanEmails.length > 0) {
    logOk("Aucune invitation en attente pour ces emails (ou déjà marquées utilisées).");
  } else if (unusedInvitations.length > 0) {
    logWarn(unusedInvitations.length + " invitation(s) non marquée(s) comme utilisées.");
    for (const inv of unusedInvitations) {
      console.log("   - " + inv.email + " | lease_id: " + (inv.lease_id ?? "N/A") + " | id: " + inv.id.slice(0, 8) + "...");
    }
  }

  const leaseIds = [...new Set(orphans.map((o) => o.lease_id))];
  const notifCountByLease = await countTenantAccountNotificationsForLeases(leaseIds);
  logSection("4. Notifications propriétaire (tenant_account_created)");
  let missingNotif = 0;
  for (const lid of leaseIds) {
    const count = notifCountByLease.get(lid) ?? 0;
    if (count === 0) {
      missingNotif++;
      logWarn("Bail " + lid.slice(0, 8) + "... : aucune notification \"Locataire inscrit\" pour le propriétaire.");
    } else {
      logOk("Bail " + lid.slice(0, 8) + "... : " + count + " notification(s).");
    }
  }
  if (missingNotif === 0 && leaseIds.length > 0) logOk("Tous les baux concernés ont au moins une notification.");

  if (fixable.length > 0 || unusedInvitations.length > 0) {
    logSection("5. Scripts SQL correctifs (à exécuter dans Supabase SQL Editor)");
    const emailsToFix = [...new Set(fixable.map((o) => (o.invited_email ?? "").toLowerCase().trim()).filter(Boolean))];
    if (emailsToFix.length > 0) {
      console.log("--- Lier lease_signers orphelins ---\n");
      console.log(generateFixSqlLinkOrphans(emailsToFix));
      console.log("\n--- Marquer invitations utilisées ---\n");
      console.log(generateFixSqlMarkInvitations(emailsToFix));
    }
    console.log("\nAprès exécution, relancez ce script pour vérifier.");
  }

  console.log("\n" + BLUE + "═══════════════════════════════════════════════════════" + RESET + "\n");
}

const filterEmail = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];
runAudit(filterEmail).catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
