export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Anonymisation Cascade RGPD - Article 17 (Droit à l'effacement)
 * 
 * Anonymise toutes les données d'un utilisateur de manière complète
 * en cascade sur toutes les tables liées.
 * 
 * POST /api/privacy/anonymize/cascade
 * 
 * IMPORTANT:
 * - Opération irréversible
 * - Nécessite confirmation explicite
 * - Conserve les données financières anonymisées (obligations légales)
 * - Log complet dans audit_log
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface AnonymizeRequest {
  user_id: string;
  reason: string;
  confirmation: string; // Doit être "CONFIRMER_SUPPRESSION"
  keep_financial_records?: boolean; // true par défaut (obligation légale)
}

interface AnonymizeResult {
  success: boolean;
  user_id: string;
  tables_processed: {
    table: string;
    rows_affected: number;
  }[];
  documents_deleted: number;
  total_rows_affected: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que c'est un admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((adminProfile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut anonymiser les données" },
        { status: 403 }
      );
    }

    const body: AnonymizeRequest = await request.json();
    const { user_id, reason, confirmation, keep_financial_records = true } = body;

    // Validations
    if (!user_id) {
      return NextResponse.json(
        { error: "user_id requis" },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 20) {
      return NextResponse.json(
        { error: "Une raison détaillée est requise (min 20 caractères)" },
        { status: 400 }
      );
    }

    if (confirmation !== "CONFIRMER_SUPPRESSION") {
      return NextResponse.json(
        { error: "Confirmation invalide. Envoyez confirmation: 'CONFIRMER_SUPPRESSION'" },
        { status: 400 }
      );
    }

    // Récupérer le profil cible
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("user_id", user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Interdire l'anonymisation d'un admin
    if ((targetProfile as any).role === "admin") {
      return NextResponse.json(
        { error: "Impossible d'anonymiser un administrateur" },
        { status: 403 }
      );
    }

    const profileId = (targetProfile as any).id;
    const result: AnonymizeResult = {
      success: false,
      user_id,
      tables_processed: [],
      documents_deleted: 0,
      total_rows_affected: 0,
    };

    // ============================================
    // 1. ANONYMISER LE PROFIL PRINCIPAL
    // ============================================
    const { count: profileCount } = await supabase
      .from("profiles")
      .update({
        prenom: "UTILISATEUR",
        nom: "ANONYME",
        email: `anonyme_${Date.now()}@deleted.local`,
        telephone: null,
        avatar_url: null,
        date_naissance: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user_id)
      .select("*", { count: "exact", head: true });

    result.tables_processed.push({
      table: "profiles",
      rows_affected: profileCount || 0,
    });

    // ============================================
    // 2. ANONYMISER LES PROFILS SPÉCIFIQUES
    // ============================================

    // Owner profile
    const { count: ownerCount } = await supabase
      .from("owner_profiles")
      .update({
        siret: null,
        tva: null,
        iban: null,
        adresse_facturation: null,
      } as any)
      .eq("profile_id", profileId)
      .select("*", { count: "exact", head: true });

    if (ownerCount) {
      result.tables_processed.push({
        table: "owner_profiles",
        rows_affected: ownerCount,
      });
    }

    // Tenant profile
    const { count: tenantCount } = await supabase
      .from("tenant_profiles")
      .update({
        situation_pro: null,
        revenus_mensuels: null,
        employeur: null,
        employeur_adresse: null,
        employeur_telephone: null,
      } as any)
      .eq("profile_id", profileId)
      .select("*", { count: "exact", head: true });

    if (tenantCount) {
      result.tables_processed.push({
        table: "tenant_profiles",
        rows_affected: tenantCount,
      });
    }

    // Provider profile
    const { count: providerCount } = await supabase
      .from("provider_profiles")
      .update({
        siret: null,
        certifications: null,
        zones_intervention: null,
      } as any)
      .eq("profile_id", profileId)
      .select("*", { count: "exact", head: true });

    if (providerCount) {
      result.tables_processed.push({
        table: "provider_profiles",
        rows_affected: providerCount,
      });
    }

    // ============================================
    // 3. ANONYMISER LES CONSENTEMENTS
    // ============================================
    const { count: consentsCount } = await supabase
      .from("user_consents")
      .delete()
      .eq("user_id", user_id)
      .select("*", { count: "exact", head: true });

    if (consentsCount) {
      result.tables_processed.push({
        table: "user_consents",
        rows_affected: consentsCount,
      });
    }

    // ============================================
    // 4. ANONYMISER LES TICKETS
    // ============================================
    const { count: ticketsCount } = await supabase
      .from("tickets")
      .update({
        description: "[Contenu supprimé - RGPD]",
      } as any)
      .eq("created_by_profile_id", profileId)
      .select("*", { count: "exact", head: true });

    if (ticketsCount) {
      result.tables_processed.push({
        table: "tickets",
        rows_affected: ticketsCount,
      });
    }

    // Messages des tickets
    const { data: userTickets } = await supabase
      .from("tickets")
      .select("id")
      .eq("created_by_profile_id", profileId);

    if (userTickets && userTickets.length > 0) {
      const ticketIds = userTickets.map((t: any) => t.id);
      const { count: messagesCount } = await supabase
        .from("ticket_messages")
        .update({
          content: "[Message supprimé - RGPD]",
        } as any)
        .in("ticket_id", ticketIds)
        .select("*", { count: "exact", head: true });

      if (messagesCount) {
        result.tables_processed.push({
          table: "ticket_messages",
          rows_affected: messagesCount,
        });
      }
    }

    // ============================================
    // 5. ANONYMISER LES NOTIFICATIONS
    // ============================================
    const { count: notificationsCount } = await supabase
      .from("notifications")
      .delete()
      .eq("profile_id", profileId)
      .select("*", { count: "exact", head: true });

    if (notificationsCount) {
      result.tables_processed.push({
        table: "notifications",
        rows_affected: notificationsCount,
      });
    }

    // ============================================
    // 6. GÉRER LES DOCUMENTS
    // ============================================
    // Récupérer les documents
    const { data: documents } = await supabase
      .from("documents")
      .select("id, storage_path, type")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);

    if (documents && documents.length > 0) {
      // Supprimer du storage les documents non financiers
      for (const doc of documents) {
        const docType = (doc as any).type;
        const isFinancial = ['quittance', 'facture', 'invoice'].includes(docType);
        
        if (!isFinancial || !keep_financial_records) {
          try {
            await supabase.storage
              .from("documents")
              .remove([(doc as any).storage_path]);
            result.documents_deleted++;
          } catch (e) {
            console.warn(`Impossible de supprimer ${(doc as any).storage_path}`);
          }
        }
      }

      // Anonymiser les métadonnées
      const { count: docsCount } = await supabase
        .from("documents")
        .update({
          metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
        } as any)
        .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`)
        .select("*", { count: "exact", head: true });

      if (docsCount) {
        result.tables_processed.push({
          table: "documents",
          rows_affected: docsCount,
        });
      }
    }

    // ============================================
    // 7. ANONYMISER LES DONNÉES FINANCIÈRES (si autorisé)
    // ============================================
    if (!keep_financial_records) {
      // Factures
      const { count: invoicesCount } = await supabase
        .from("invoices")
        .update({
          metadata: { anonymized: true },
        } as any)
        .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`)
        .select("*", { count: "exact", head: true });

      if (invoicesCount) {
        result.tables_processed.push({
          table: "invoices",
          rows_affected: invoicesCount,
        });
      }
    }

    // ============================================
    // 8. ANONYMISER LES LOGS DE CONNEXION
    // ============================================
    const { count: auditCount } = await supabase
      .from("audit_log")
      .update({
        metadata: { anonymized: true },
        ip_address: null,
      } as any)
      .eq("user_id", user_id)
      .select("*", { count: "exact", head: true });

    if (auditCount) {
      result.tables_processed.push({
        table: "audit_log",
        rows_affected: auditCount,
      });
    }

    // ============================================
    // 9. SUPPRIMER LES PHOTOS IDENTITÉ
    // ============================================
    const { data: identityDocs } = await supabase
      .from("tenant_identity_documents")
      .select("id, storage_path")
      .eq("tenant_id", profileId);

    if (identityDocs && identityDocs.length > 0) {
      for (const doc of identityDocs) {
        try {
          await supabase.storage
            .from("identity")
            .remove([(doc as any).storage_path]);
          result.documents_deleted++;
        } catch (e) {
          console.warn(`Impossible de supprimer identity/${(doc as any).storage_path}`);
        }
      }

      const { count: identityCount } = await supabase
        .from("tenant_identity_documents")
        .delete()
        .eq("tenant_id", profileId)
        .select("*", { count: "exact", head: true });

      if (identityCount) {
        result.tables_processed.push({
          table: "tenant_identity_documents",
          rows_affected: identityCount,
        });
      }
    }

    // ============================================
    // 10. LOGGER L'OPÉRATION
    // ============================================
    result.total_rows_affected = result.tables_processed.reduce(
      (sum, t) => sum + t.rows_affected,
      0
    );
    result.success = true;

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "data_anonymized_cascade",
      entity_type: "user",
      entity_id: user_id,
      metadata: {
        reason,
        admin_email: user.email,
        tables_processed: result.tables_processed,
        documents_deleted: result.documents_deleted,
        total_rows_affected: result.total_rows_affected,
        keep_financial_records,
        timestamp: new Date().toISOString(),
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Données anonymisées avec succès",
      result,
    });

  } catch (error: unknown) {
    console.error("[privacy/anonymize/cascade] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

