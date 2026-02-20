/**
 * AUDIT COMPLET DES CONNEXIONS ENTRE COMPTES
 * 
 * Analyse la connexion entre:
 * - Propriétaire: contact.explore.mq@gmail.com
 * - Locataire: volberg.thomas@hotmail.fr
 * 
 * Usage: npx tsx scripts/audit-account-connections.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OWNER_EMAIL = "contact.explore.mq@gmail.com";
const TENANT_EMAIL = "volberg.thomas@hotmail.fr";

interface AuditReport {
  timestamp: string;
  ownerAnalysis: OwnerAnalysis;
  tenantAnalysis: TenantAnalysis;
  connectionAnalysis: ConnectionAnalysis;
  notificationAnalysis: NotificationAnalysis;
  invitationAnalysis: InvitationAnalysis;
  ruptures: Rupture[];
  recommendations: string[];
}

interface OwnerAnalysis {
  authUser: any | null;
  profile: any | null;
  ownerProfile: any | null;
  properties: any[];
  leases: any[];
}

interface TenantAnalysis {
  authUser: any | null;
  profile: any | null;
  tenantProfile: any | null;
  linkedLeases: any[];
  leaseSigners: any[];
}

interface ConnectionAnalysis {
  leaseSignersWithEmail: any[];
  leaseSignersWithProfile: any[];
  orphanSigners: any[];
  propertyTenantLinks: any[];
}

interface NotificationAnalysis {
  ownerNotifications: any[];
  tenantNotifications: any[];
  missingNotifications: string[];
}

interface InvitationAnalysis {
  invitationsSent: any[];
  invitationsUsed: any[];
  invitationsPending: any[];
  invitationsExpired: any[];
}

interface Rupture {
  type: "CRITIQUE" | "IMPORTANT" | "MINEUR";
  location: string;
  description: string;
  expectedValue: string;
  actualValue: string;
  fix?: string;
}

async function runAudit() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLET DES CONNEXIONS ENTRE COMPTES");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`📧 Propriétaire: ${OWNER_EMAIL}`);
  console.log(`📧 Locataire: ${TENANT_EMAIL}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    ownerAnalysis: { authUser: null, profile: null, ownerProfile: null, properties: [], leases: [] },
    tenantAnalysis: { authUser: null, profile: null, tenantProfile: null, linkedLeases: [], leaseSigners: [] },
    connectionAnalysis: { leaseSignersWithEmail: [], leaseSignersWithProfile: [], orphanSigners: [], propertyTenantLinks: [] },
    notificationAnalysis: { ownerNotifications: [], tenantNotifications: [], missingNotifications: [] },
    invitationAnalysis: { invitationsSent: [], invitationsUsed: [], invitationsPending: [], invitationsExpired: [] },
    ruptures: [],
    recommendations: [],
  };

  // ============================================
  // 1. ANALYSE DU COMPTE PROPRIÉTAIRE
  // ============================================
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 1. ANALYSE DU COMPTE PROPRIÉTAIRE                           │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // 1.1 Vérifier auth.users
  const { data: ownerUsers } = await supabase.auth.admin.listUsers();
  const ownerAuthUser = ownerUsers?.users?.find(u => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
  report.ownerAnalysis.authUser = ownerAuthUser || null;

  if (ownerAuthUser) {
    console.log(`✅ auth.users: Trouvé`);
    console.log(`   ID: ${ownerAuthUser.id}`);
    console.log(`   Email: ${ownerAuthUser.email}`);
    console.log(`   Confirmé: ${ownerAuthUser.email_confirmed_at ? "Oui" : "Non"}`);
    console.log(`   Créé: ${ownerAuthUser.created_at}`);
  } else {
    console.log("❌ auth.users: NON TROUVÉ");
    report.ruptures.push({
      type: "CRITIQUE",
      location: "auth.users",
      description: "Compte propriétaire non trouvé dans auth.users",
      expectedValue: OWNER_EMAIL,
      actualValue: "null",
    });
  }

  // 1.2 Vérifier profiles
  if (ownerAuthUser) {
    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", ownerAuthUser.id)
      .single();

    report.ownerAnalysis.profile = ownerProfile || null;

    if (ownerProfile) {
      console.log(`\n✅ profiles: Trouvé`);
      console.log(`   ID: ${ownerProfile.id}`);
      console.log(`   Rôle: ${ownerProfile.role}`);
      console.log(`   Nom: ${ownerProfile.prenom} ${ownerProfile.nom}`);
      console.log(`   Email (colonne): ${ownerProfile.email || "NULL"}`);
    } else {
      console.log(`\n❌ profiles: NON TROUVÉ (${ownerProfileError?.message})`);
      report.ruptures.push({
        type: "CRITIQUE",
        location: "profiles",
        description: "Profil propriétaire non lié à auth.users",
        expectedValue: `profile.user_id = ${ownerAuthUser.id}`,
        actualValue: "null",
      });
    }

    // 1.3 Vérifier owner_profiles
    if (ownerProfile) {
      const { data: ownerSpecProfile } = await supabase
        .from("owner_profiles")
        .select("*")
        .eq("profile_id", ownerProfile.id)
        .single();

      report.ownerAnalysis.ownerProfile = ownerSpecProfile || null;

      if (ownerSpecProfile) {
        console.log(`\n✅ owner_profiles: Trouvé`);
        console.log(`   Type: ${ownerSpecProfile.type || "N/A"}`);
      } else {
        console.log(`\n⚠️ owner_profiles: Non trouvé (peut être normal)`);
      }

      // 1.4 Vérifier les biens
      const { data: properties } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", ownerProfile.id);

      report.ownerAnalysis.properties = properties || [];

      console.log(`\n📊 Biens du propriétaire: ${properties?.length || 0}`);
      if (properties && properties.length > 0) {
        for (const prop of properties) {
          console.log(`   - ${prop.id.substring(0, 8)}... | ${prop.adresse_complete || prop.nom || "N/A"} | Code: ${prop.unique_code || "N/A"}`);
        }
      }

      // 1.5 Vérifier les baux créés par ce propriétaire
      const propertyIds = properties?.map(p => p.id) || [];
      if (propertyIds.length > 0) {
        const { data: leases } = await supabase
          .from("leases")
          .select("*")
          .in("property_id", propertyIds);

        report.ownerAnalysis.leases = leases || [];

        console.log(`\n📄 Baux du propriétaire: ${leases?.length || 0}`);
        if (leases && leases.length > 0) {
          for (const lease of leases) {
            console.log(`   - ${lease.id.substring(0, 8)}... | Statut: ${lease.statut} | Type: ${lease.type_bail} | Loyer: ${lease.loyer}€`);
          }
        }
      }
    }
  }

  // ============================================
  // 2. ANALYSE DU COMPTE LOCATAIRE
  // ============================================
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 2. ANALYSE DU COMPTE LOCATAIRE                              │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // 2.1 Vérifier auth.users
  const tenantAuthUser = ownerUsers?.users?.find(u => u.email?.toLowerCase() === TENANT_EMAIL.toLowerCase());
  report.tenantAnalysis.authUser = tenantAuthUser || null;

  if (tenantAuthUser) {
    console.log(`✅ auth.users: Trouvé`);
    console.log(`   ID: ${tenantAuthUser.id}`);
    console.log(`   Email: ${tenantAuthUser.email}`);
    console.log(`   Confirmé: ${tenantAuthUser.email_confirmed_at ? "Oui" : "Non"}`);
    console.log(`   Créé: ${tenantAuthUser.created_at}`);
  } else {
    console.log("❌ auth.users: NON TROUVÉ");
    report.ruptures.push({
      type: "CRITIQUE",
      location: "auth.users",
      description: "Compte locataire non trouvé dans auth.users",
      expectedValue: TENANT_EMAIL,
      actualValue: "null",
    });
  }

  // 2.2 Vérifier profiles
  if (tenantAuthUser) {
    const { data: tenantProfile, error: tenantProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", tenantAuthUser.id)
      .single();

    report.tenantAnalysis.profile = tenantProfile || null;

    if (tenantProfile) {
      console.log(`\n✅ profiles: Trouvé`);
      console.log(`   ID: ${tenantProfile.id}`);
      console.log(`   Rôle: ${tenantProfile.role}`);
      console.log(`   Nom: ${tenantProfile.prenom} ${tenantProfile.nom}`);
      console.log(`   Email (colonne): ${tenantProfile.email || "NULL"}`);

      // Vérifier si le rôle est correct
      if (tenantProfile.role !== "tenant") {
        report.ruptures.push({
          type: "IMPORTANT",
          location: "profiles.role",
          description: "Le rôle du locataire n'est pas 'tenant'",
          expectedValue: "tenant",
          actualValue: tenantProfile.role,
          fix: `UPDATE profiles SET role = 'tenant' WHERE id = '${tenantProfile.id}'`,
        });
      }
    } else {
      console.log(`\n❌ profiles: NON TROUVÉ (${tenantProfileError?.message})`);
      report.ruptures.push({
        type: "CRITIQUE",
        location: "profiles",
        description: "Profil locataire non lié à auth.users",
        expectedValue: `profile.user_id = ${tenantAuthUser.id}`,
        actualValue: "null",
      });
    }

    // 2.3 Vérifier tenant_profiles
    if (tenantProfile) {
      const { data: tenantSpecProfile } = await supabase
        .from("tenant_profiles")
        .select("*")
        .eq("profile_id", tenantProfile.id)
        .single();

      report.tenantAnalysis.tenantProfile = tenantSpecProfile || null;

      if (tenantSpecProfile) {
        console.log(`\n✅ tenant_profiles: Trouvé`);
      } else {
        console.log(`\n⚠️ tenant_profiles: Non trouvé`);
      }
    }
  }

  // ============================================
  // 3. ANALYSE DES LEASE_SIGNERS
  // ============================================
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 3. ANALYSE DES LEASE_SIGNERS (Connexion bail-locataire)     │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // 3.1 Chercher par invited_email
  const { data: signersByEmail } = await supabase
    .from("lease_signers")
    .select(`
      *,
      leases:lease_id (
        id, statut, type_bail, loyer,
        properties:property_id (
          id, adresse_complete, owner_id
        )
      )
    `)
    .ilike("invited_email", TENANT_EMAIL);

  report.connectionAnalysis.leaseSignersWithEmail = signersByEmail || [];

  console.log(`📧 Signataires avec invited_email = "${TENANT_EMAIL}": ${signersByEmail?.length || 0}`);
  if (signersByEmail && signersByEmail.length > 0) {
    for (const signer of signersByEmail) {
      const lease = signer.leases as any;
      const prop = lease?.properties as any;
      console.log(`   - Signer ID: ${signer.id.substring(0, 8)}...`);
      console.log(`     Lease: ${lease?.id?.substring(0, 8) || "N/A"}... | Statut: ${lease?.statut || "N/A"}`);
      console.log(`     Rôle: ${signer.role} | Signature: ${signer.signature_status}`);
      console.log(`     profile_id: ${signer.profile_id || "❌ NULL"}`);
      console.log(`     Propriété: ${prop?.adresse_complete || "N/A"}`);
      
      if (!signer.profile_id) {
        report.ruptures.push({
          type: "CRITIQUE",
          location: "lease_signers.profile_id",
          description: `Signataire avec invited_email="${TENANT_EMAIL}" mais profile_id NULL`,
          expectedValue: `profile_id du locataire`,
          actualValue: "NULL",
          fix: report.tenantAnalysis.profile 
            ? `UPDATE lease_signers SET profile_id = '${report.tenantAnalysis.profile.id}' WHERE id = '${signer.id}'`
            : "Créer d'abord le profil locataire",
        });
      }
    }
  } else {
    console.log("   ⚠️ Aucun signataire trouvé avec cet email");
  }

  // 3.2 Chercher par profile_id (si profil locataire existe)
  if (report.tenantAnalysis.profile) {
    const { data: signersByProfile } = await supabase
      .from("lease_signers")
      .select(`
        *,
        leases:lease_id (
          id, statut, type_bail, loyer,
          properties:property_id (
            id, adresse_complete, owner_id
          )
        )
      `)
      .eq("profile_id", report.tenantAnalysis.profile.id);

    report.connectionAnalysis.leaseSignersWithProfile = signersByProfile || [];
    report.tenantAnalysis.leaseSigners = signersByProfile || [];

    console.log(`\n👤 Signataires avec profile_id = "${report.tenantAnalysis.profile.id.substring(0, 8)}...": ${signersByProfile?.length || 0}`);
    if (signersByProfile && signersByProfile.length > 0) {
      for (const signer of signersByProfile) {
        const lease = signer.leases as any;
        const prop = lease?.properties as any;
        console.log(`   - Signer ID: ${signer.id.substring(0, 8)}...`);
        console.log(`     Lease: ${lease?.id?.substring(0, 8) || "N/A"}... | Statut: ${lease?.statut || "N/A"}`);
        console.log(`     Rôle: ${signer.role} | Signature: ${signer.signature_status}`);
        console.log(`     Propriété: ${prop?.adresse_complete || "N/A"}`);
      }
    } else {
      console.log("   ⚠️ Aucun signataire trouvé avec ce profile_id");
      if ((signersByEmail?.length || 0) > 0) {
        report.ruptures.push({
          type: "CRITIQUE",
          location: "lease_signers",
          description: "Des signataires ont l'email du locataire mais pas son profile_id",
          expectedValue: "profile_id = " + report.tenantAnalysis.profile.id,
          actualValue: "profile_id = NULL",
        });
      }
    }
  }

  // ============================================
  // 4. ANALYSE DES INVITATIONS
  // ============================================
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 4. ANALYSE DES INVITATIONS                                  │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  const { data: invitations } = await supabase
    .from("invitations")
    .select(`
      *,
      leases:lease_id (
        id, statut, type_bail,
        properties:property_id (
          id, adresse_complete, owner_id
        )
      ),
      creator:created_by (
        id, prenom, nom, email
      )
    `)
    .ilike("email", TENANT_EMAIL)
    .order("created_at", { ascending: false });

  const now = new Date();
  for (const inv of invitations || []) {
    if (inv.used_at) {
      report.invitationAnalysis.invitationsUsed.push(inv);
    } else if (new Date(inv.expires_at as string) < now) {
      report.invitationAnalysis.invitationsExpired.push(inv);
    } else {
      report.invitationAnalysis.invitationsPending.push(inv);
    }
    report.invitationAnalysis.invitationsSent.push(inv);
  }

  console.log(`📨 Invitations envoyées à "${TENANT_EMAIL}": ${invitations?.length || 0}`);
  
  if (invitations && invitations.length > 0) {
    for (const inv of invitations) {
      const lease = inv.leases as any;
      const prop = lease?.properties as any;
      const creator = inv.creator as any;
      const status = inv.used_at ? "✅ Utilisée" : (new Date(inv.expires_at as string) < now ? "❌ Expirée" : "⏳ En attente");
      
      console.log(`\n   - Invitation ID: ${inv.id.substring(0, 8)}...`);
      console.log(`     Status: ${status}`);
      console.log(`     Créée par: ${creator?.prenom || ""} ${creator?.nom || ""} (${creator?.email || "N/A"})`);
      console.log(`     Rôle: ${inv.role}`);
      console.log(`     Bail: ${lease?.id?.substring(0, 8) || "N/A"}...`);
      console.log(`     Propriété: ${prop?.adresse_complete || "N/A"}`);
      console.log(`     Créée: ${inv.created_at}`);
      console.log(`     Expire: ${inv.expires_at}`);
      if (inv.used_at) {
        console.log(`     Utilisée: ${inv.used_at}`);
        console.log(`     used_by: ${inv.used_by || "NULL"}`);
      }
    }
  } else {
    console.log("   ⚠️ Aucune invitation trouvée pour ce locataire");
    report.ruptures.push({
      type: "IMPORTANT",
      location: "invitations",
      description: "Aucune invitation trouvée pour le locataire",
      expectedValue: "Au moins 1 invitation",
      actualValue: "0",
    });
  }

  // Vérifier si les invitations utilisées ont bien lié le profil
  for (const inv of report.invitationAnalysis.invitationsUsed) {
    if (!inv.used_by) {
      report.ruptures.push({
        type: "IMPORTANT",
        location: "invitations.used_by",
        description: "Invitation marquée comme utilisée mais used_by est NULL",
        expectedValue: "profile_id du locataire",
        actualValue: "NULL",
      });
    }
  }

  // ============================================
  // 5. ANALYSE DES NOTIFICATIONS
  // ============================================
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 5. ANALYSE DES NOTIFICATIONS                                │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // 5.1 Notifications du propriétaire
  if (report.ownerAnalysis.profile) {
    const { data: ownerNotifs } = await supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${report.ownerAnalysis.authUser?.id},profile_id.eq.${report.ownerAnalysis.profile.id}`)
      .order("created_at", { ascending: false })
      .limit(20);

    report.notificationAnalysis.ownerNotifications = ownerNotifs || [];

    console.log(`🔔 Notifications du propriétaire: ${ownerNotifs?.length || 0}`);
    if (ownerNotifs && ownerNotifs.length > 0) {
      for (const notif of ownerNotifs.slice(0, 5)) {
        console.log(`   - ${notif.type}: ${notif.title}`);
        console.log(`     Lue: ${notif.read || notif.is_read ? "Oui" : "Non"} | Créée: ${notif.created_at}`);
      }
      if (ownerNotifs.length > 5) {
        console.log(`   ... et ${ownerNotifs.length - 5} autres`);
      }
    }

    // Vérifier si le propriétaire a reçu une notification "tenant_account_created"
    const tenantCreatedNotif = ownerNotifs?.find(n => n.type === "tenant_account_created");
    if (!tenantCreatedNotif && report.tenantAnalysis.authUser) {
      report.ruptures.push({
        type: "IMPORTANT",
        location: "notifications",
        description: "Le propriétaire n'a pas reçu de notification 'tenant_account_created'",
        expectedValue: "Notification de type 'tenant_account_created'",
        actualValue: "Non trouvée",
      });
      report.notificationAnalysis.missingNotifications.push("tenant_account_created pour le propriétaire");
    }
  }

  // 5.2 Notifications du locataire
  if (report.tenantAnalysis.profile || report.tenantAnalysis.authUser) {
    const conditions: string[] = [];
    if (report.tenantAnalysis.authUser) {
      conditions.push(`user_id.eq.${report.tenantAnalysis.authUser.id}`);
    }
    if (report.tenantAnalysis.profile) {
      conditions.push(`profile_id.eq.${report.tenantAnalysis.profile.id}`);
    }

    const { data: tenantNotifs } = await supabase
      .from("notifications")
      .select("*")
      .or(conditions.join(","))
      .order("created_at", { ascending: false })
      .limit(20);

    report.notificationAnalysis.tenantNotifications = tenantNotifs || [];

    console.log(`\n🔔 Notifications du locataire: ${tenantNotifs?.length || 0}`);
    if (tenantNotifs && tenantNotifs.length > 0) {
      for (const notif of tenantNotifs.slice(0, 5)) {
        console.log(`   - ${notif.type}: ${notif.title}`);
        console.log(`     Lue: ${notif.read || notif.is_read ? "Oui" : "Non"} | Créée: ${notif.created_at}`);
      }
      if (tenantNotifs.length > 5) {
        console.log(`   ... et ${tenantNotifs.length - 5} autres`);
      }
    } else {
      console.log("   ⚠️ Aucune notification pour le locataire");
      report.ruptures.push({
        type: "IMPORTANT",
        location: "notifications",
        description: "Le locataire n'a reçu aucune notification",
        expectedValue: "Au moins une notification (lease_invite, etc.)",
        actualValue: "0 notifications",
      });
      report.notificationAnalysis.missingNotifications.push("Toutes les notifications pour le locataire");
    }

    // Vérifier notification lease_invite
    const leaseInviteNotif = tenantNotifs?.find(n => n.type === "lease_invite");
    if (!leaseInviteNotif && (signersByEmail?.length || 0) > 0) {
      report.ruptures.push({
        type: "IMPORTANT",
        location: "notifications",
        description: "Le locataire n'a pas de notification 'lease_invite' alors qu'il a été invité",
        expectedValue: "Notification de type 'lease_invite'",
        actualValue: "Non trouvée",
      });
      report.notificationAnalysis.missingNotifications.push("lease_invite pour le locataire");
    }
  }

  // ============================================
  // 6. VÉRIFICATION DES TRIGGERS AUTO-LINK
  // ============================================
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│ 6. VÉRIFICATION DE L'AUTO-LINK                              │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // Vérifier si le trigger a fonctionné
  const signersWithEmailNoProfile = (signersByEmail || []).filter(s => !s.profile_id);
  if (signersWithEmailNoProfile.length > 0 && report.tenantAnalysis.profile) {
    console.log("❌ AUTO-LINK NON FONCTIONNEL");
    console.log(`   ${signersWithEmailNoProfile.length} signataire(s) avec invited_email="${TENANT_EMAIL}" mais profile_id=NULL`);
    console.log(`   Le profil locataire existe (ID: ${report.tenantAnalysis.profile.id})`);
    console.log("   → Le trigger auto_link_lease_signers_on_profile_created() n'a pas fonctionné");
    
    report.ruptures.push({
      type: "CRITIQUE",
      location: "trigger:auto_link_lease_signers_on_profile_created",
      description: "Le trigger d'auto-link n'a pas lié le profil aux lease_signers",
      expectedValue: "Liaison automatique au moment de la création du profil",
      actualValue: "profile_id reste NULL",
      fix: `UPDATE lease_signers SET profile_id = '${report.tenantAnalysis.profile.id}' WHERE LOWER(invited_email) = LOWER('${TENANT_EMAIL}') AND profile_id IS NULL`,
    });
  } else if (signersWithEmailNoProfile.length === 0 && (signersByEmail?.length || 0) > 0) {
    console.log("✅ AUTO-LINK OK - Tous les signataires sont correctement liés");
  } else if (!report.tenantAnalysis.profile && (signersByEmail?.length || 0) > 0) {
    console.log("⚠️ AUTO-LINK EN ATTENTE");
    console.log("   Le profil locataire n'existe pas encore");
    console.log("   L'auto-link se fera quand le locataire créera son compte");
  }

  // ============================================
  // 7. RAPPORT FINAL
  // ============================================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                     RAPPORT FINAL                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Ruptures par criticité
  const critiques = report.ruptures.filter(r => r.type === "CRITIQUE");
  const importants = report.ruptures.filter(r => r.type === "IMPORTANT");
  const mineurs = report.ruptures.filter(r => r.type === "MINEUR");

  console.log("📊 RÉSUMÉ DES RUPTURES:");
  console.log(`   🔴 CRITIQUES: ${critiques.length}`);
  console.log(`   🟠 IMPORTANTES: ${importants.length}`);
  console.log(`   🟡 MINEURES: ${mineurs.length}`);

  if (critiques.length > 0) {
    console.log("\n🔴 RUPTURES CRITIQUES:");
    for (const r of critiques) {
      console.log(`\n   📍 ${r.location}`);
      console.log(`      ${r.description}`);
      console.log(`      Attendu: ${r.expectedValue}`);
      console.log(`      Actuel: ${r.actualValue}`);
      if (r.fix) {
        console.log(`      🔧 FIX: ${r.fix}`);
      }
    }
  }

  if (importants.length > 0) {
    console.log("\n🟠 RUPTURES IMPORTANTES:");
    for (const r of importants) {
      console.log(`\n   📍 ${r.location}`);
      console.log(`      ${r.description}`);
      console.log(`      Attendu: ${r.expectedValue}`);
      console.log(`      Actuel: ${r.actualValue}`);
      if (r.fix) {
        console.log(`      🔧 FIX: ${r.fix}`);
      }
    }
  }

  // Générer les recommandations
  if (critiques.length > 0 || importants.length > 0) {
    console.log("\n📝 RECOMMANDATIONS:");
    
    // Recommandation 1: Lier les lease_signers
    const signersToFix = critiques.filter(r => r.location === "lease_signers.profile_id");
    if (signersToFix.length > 0 && report.tenantAnalysis.profile) {
      report.recommendations.push(`Exécuter: UPDATE lease_signers SET profile_id = '${report.tenantAnalysis.profile.id}' WHERE LOWER(invited_email) = LOWER('${TENANT_EMAIL}') AND profile_id IS NULL`);
    }

    // Recommandation 2: Créer les notifications manquantes
    if (report.notificationAnalysis.missingNotifications.length > 0) {
      report.recommendations.push("Créer les notifications manquantes via l'API ou manuellement");
    }

    // Recommandation 3: Vérifier les triggers
    const triggerIssues = critiques.filter(r => r.location.startsWith("trigger:"));
    if (triggerIssues.length > 0) {
      report.recommendations.push("Vérifier que les triggers auto_link sont actifs dans Supabase");
    }

    for (let i = 0; i < report.recommendations.length; i++) {
      console.log(`   ${i + 1}. ${report.recommendations[i]}`);
    }
  }

  // Script de correction SQL
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                 SCRIPT DE CORRECTION SQL                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const fixes = report.ruptures.filter(r => r.fix);
  if (fixes.length > 0) {
    console.log("-- Exécuter ces commandes dans Supabase SQL Editor:\n");
    for (const fix of fixes) {
      console.log(`-- ${fix.description}`);
      console.log(`${fix.fix};`);
      console.log("");
    }
  } else {
    console.log("Aucune correction SQL nécessaire.");
  }

  // Sauvegarder le rapport JSON
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Rapport complet généré.");
  console.log("═══════════════════════════════════════════════════════════════\n");

  return report;
}

runAudit().catch(console.error);
