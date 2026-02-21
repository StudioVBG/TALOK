#!/usr/bin/env tsx
/**
 * Vérification en base : liaison locataire Thomas VOLBERG (bail 63 rue Victor Schoelcher).
 * Contrôle auth.users, profiles, lease_signers, leases, invoices.tenant_id.
 *
 * Usage: npx tsx scripts/verify-tenant-link-in-db.ts [email]
 *   Sans argument: cherche tout email contenant "volberg"
 *   Avec argument: ex. npx tsx scripts/verify-tenant-link-in-db.ts volberg.thomas@gmail.com
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emailFilter = process.argv[2]?.trim() || "volberg";

async function main() {
  console.log("\n═══ Vérification en base : liaison locataire (Thomas VOLBERG) ═══\n");
  console.log("Filtre email:", emailFilter.includes("@") ? emailFilter : `(contient "${emailFilter}")`);
  console.log("");

  // 1. Utilisateurs auth dont l'email correspond
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) {
    console.error("❌ Erreur auth.admin.listUsers:", usersError.message);
    process.exit(1);
  }

  const users = (usersData?.users ?? []).filter((u) => {
    const e = (u.email ?? "").toLowerCase();
    return emailFilter.includes("@") ? e === emailFilter.toLowerCase() : e.includes(emailFilter.toLowerCase());
  });

  if (users.length === 0) {
    console.log("❌ Aucun utilisateur auth trouvé pour ce filtre email.");
    process.exit(1);
  }

  for (const user of users) {
    console.log("────────────────────────────────────────────────────────────");
    console.log("📧 auth.users");
    console.log("   user_id:", user.id);
    console.log("   email:", user.email);
    console.log("");

    // 2. Profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.log("❌ Profil: introuvable ou erreur", profileError?.message ?? "");
      console.log("");
      continue;
    }

    console.log("👤 profiles");
    console.log("   profile_id:", profile.id);
    console.log("   role:", profile.role);
    console.log("   prenom, nom:", profile.prenom, profile.nom);
    console.log("");

    const userEmail = (user.email ?? "").toLowerCase().trim();
    const profileId = profile.id;

    // 3. lease_signers par invited_email
    const { data: signersByEmail, error: signersEmailErr } = await supabase
      .from("lease_signers")
      .select("id, lease_id, profile_id, invited_email, invited_name, role, signature_status")
      .ilike("invited_email", userEmail);

    if (signersEmailErr) {
      console.log("❌ lease_signers (par email):", signersEmailErr.message);
    } else {
      console.log("📋 lease_signers (recherche par invited_email = " + userEmail + ")");
      if (!signersByEmail?.length) {
        console.log("   Aucune ligne (email non trouvé dans invited_email).");
      } else {
        for (const s of signersByEmail) {
          const ok = s.profile_id === profileId;
          console.log("   - lease_id:", s.lease_id);
          console.log("     invited_email:", s.invited_email, "| invited_name:", s.invited_name);
          console.log("     profile_id:", s.profile_id, ok ? "✅ = profil Thomas" : "❌ ≠ profil (rupture)");
          console.log("     role:", s.role, "| signature_status:", s.signature_status);
        }
      }
    }
    console.log("");

    // 4. lease_signers par profile_id
    const { data: signersByProfile } = await supabase
      .from("lease_signers")
      .select("id, lease_id, invited_email, role")
      .eq("profile_id", profileId);

    console.log("📋 lease_signers (recherche par profile_id = " + profileId + ")");
    if (!signersByProfile?.length) {
      console.log("   Aucune ligne (profil non lié à un bail).");
    } else {
      for (const s of signersByProfile) {
        console.log("   - lease_id:", s.lease_id, "| invited_email:", s.invited_email, "| role:", s.role);
      }
    }
    console.log("");

    const leaseIds = [
      ...new Set([
        ...(signersByEmail ?? []).map((s) => s.lease_id),
        ...(signersByProfile ?? []).map((s) => s.lease_id),
      ]),
    ].filter(Boolean);

    if (leaseIds.length === 0) {
      console.log("⚠️ Aucun bail associé (ni par email ni par profile_id).");
      console.log("");
      continue;
    }

    // 5. Baux
    const { data: leases, error: leasesErr } = await supabase
      .from("leases")
      .select("id, property_id, statut, loyer, date_debut, date_fin")
      .in("id", leaseIds);

    if (leasesErr) {
      console.log("❌ leases:", leasesErr.message);
    } else {
      console.log("📄 leases");
      for (const l of leases ?? []) {
        console.log("   - id:", l.id, "| statut:", l.statut, "| loyer:", l.loyer, "| date_debut:", l.date_debut);
      }
    }
    console.log("");

    // 6. Propriétés (adresse)
    const propertyIds = [...new Set((leases ?? []).map((l) => l.property_id).filter(Boolean))];
    if (propertyIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, adresse_complete, ville, code_postal")
        .in("id", propertyIds);
      console.log("🏠 properties");
      for (const p of props ?? []) {
        console.log("   -", p.adresse_complete, p.code_postal, p.ville);
      }
      console.log("");
    }

    // 7. Factures : tenant_id renseigné ?
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, lease_id, periode, montant_total, tenant_id, statut")
      .in("lease_id", leaseIds)
      .order("periode", { ascending: false })
      .limit(15);

    console.log("🧾 invoices (pour ces baux, 15 dernières)");
    if (!invoices?.length) {
      console.log("   Aucune facture.");
    } else {
      let nullTenant = 0;
      for (const i of invoices) {
        const ok = i.tenant_id === profileId;
        if (!ok && i.tenant_id == null) nullTenant++;
        console.log("   - periode:", i.periode, "| tenant_id:", i.tenant_id ?? "NULL", ok ? "✅" : i.tenant_id == null ? "⚠️ NULL" : "❌");
      }
      if (nullTenant > 0) {
        console.log("   ⚠️", nullTenant, "facture(s) avec tenant_id NULL (backfill recommandé).");
      }
    }
  }

  console.log("\n═══ Fin vérification ═══\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
