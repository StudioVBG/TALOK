import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * API SOTA 2026: Conseils personnalisés pour le locataire
 *
 * Analyse l'état complet du profil locataire et retourne un conseil
 * priorisé avec une action contextuelle.
 */

interface TipResponse {
  message: string;
  action: { label: string; href: string };
  priority: "high" | "medium" | "low";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const service = getServiceClient();

    // Récupérer le profil
    const { data: profile } = await service
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        message: "Complétez votre profil pour accéder à toutes les fonctionnalités.",
        action: { label: "Mon profil", href: "/tenant/profile" },
        priority: "medium",
      } satisfies TipResponse);
    }

    // Charger les données en parallèle
    const [
      leasesResult,
      insuranceResult,
      invoicesResult,
      documentsResult,
      metersResult,
      tenantProfileResult,
    ] = await Promise.allSettled([
      // Baux actifs
      service
        .from("lease_signers")
        .select("lease_id, role, signature_status, leases!inner(id, statut, loyer)")
        .eq("profile_id", profile.id)
        .in("role", ["locataire_principal", "colocataire"]),
      // Assurance
      service
        .from("documents")
        .select("id, expiry_date")
        .eq("tenant_id", profile.id)
        .eq("type", "attestation_assurance")
        .eq("is_archived", false)
        .order("expiry_date", { ascending: false })
        .limit(1),
      // Factures impayées
      service
        .from("invoices")
        .select("id, statut, montant_total, date_echeance")
        .eq("tenant_id", profile.id)
        .in("statut", ["sent", "late", "partial"]),
      // Documents du locataire
      service
        .from("documents")
        .select("id, type")
        .eq("tenant_id", profile.id)
        .eq("is_archived", false),
      // Compteurs avec dernière lecture
      service
        .from("lease_signers")
        .select("leases!inner(property_id)")
        .eq("profile_id", profile.id)
        .in("role", ["locataire_principal", "colocataire"]),
      // Profil KYC
      service
        .from("tenant_profiles")
        .select("kyc_status")
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

    const getData = <T>(result: PromiseSettledResult<any>): T | null =>
      result.status === "fulfilled" ? result.value?.data : null;

    const leaseSigners = getData<any[]>(leasesResult) || [];
    const insuranceDocs = getData<any[]>(insuranceResult) || [];
    const unpaidInvoices = getData<any[]>(invoicesResult) || [];
    const documents = getData<any[]>(documentsResult) || [];
    const meterLeases = getData<any[]>(metersResult) || [];
    const tenantProfile = getData<{ kyc_status: string } | null>(tenantProfileResult);

    // Baux actifs
    const activeLeases = leaseSigners.filter(
      (ls: any) => ls.leases?.statut === "active" || ls.leases?.statut === "fully_signed"
    );
    const pendingSignatureLeases = leaseSigners.filter(
      (ls: any) => ls.leases?.statut === "pending_signature" && ls.signature_status !== "signed"
    );

    // --- LOGIQUE DE PRIORISATION (du plus urgent au moins) ---

    // 1. Impayé en cours (HIGH)
    const lateInvoices = unpaidInvoices.filter((i: any) => i.statut === "late");
    if (lateInvoices.length > 0) {
      const totalLate = lateInvoices.reduce((sum: number, i: any) => sum + Number(i.montant_total || 0), 0);
      return NextResponse.json({
        message: `Vous avez ${totalLate.toFixed(2)} € d'impayé en retard. Régularisez rapidement pour maintenir un bon score locataire.`,
        action: { label: "Régulariser", href: "/tenant/payments" },
        priority: "high",
      } satisfies TipResponse);
    }

    // 2. Facture en attente (MEDIUM)
    if (unpaidInvoices.length > 0) {
      const nextDue = unpaidInvoices
        .filter((i: any) => i.date_echeance)
        .sort((a: any, b: any) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())[0];
      if (nextDue) {
        const daysLeft = Math.ceil(
          (new Date(nextDue.date_echeance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 5 && daysLeft >= 0) {
          return NextResponse.json({
            message: `Votre loyer est dû dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Pensez à le régler pour éviter les frais de retard.`,
            action: { label: "Payer", href: "/tenant/payments" },
            priority: "high",
          } satisfies TipResponse);
        }
      }
    }

    // 3. Bail à signer (HIGH)
    if (pendingSignatureLeases.length > 0) {
      return NextResponse.json({
        message: "Votre bail est prêt à être signé ! Finalisez la signature pour activer votre espace locataire.",
        action: { label: "Signer", href: "/tenant/onboarding/sign" },
        priority: "high",
      } satisfies TipResponse);
    }

    // 4. Assurance manquante (MEDIUM)
    const insuranceDoc = insuranceDocs[0];
    const hasInsurance = insuranceDoc
      ? (!insuranceDoc.expiry_date || new Date(insuranceDoc.expiry_date) > new Date())
      : false;

    if (!hasInsurance && activeLeases.length > 0) {
      return NextResponse.json({
        message: "Pensez à déposer votre attestation d'assurance habitation pour être en conformité avec votre bail.",
        action: { label: "Déposer", href: "/tenant/documents" },
        priority: "medium",
      } satisfies TipResponse);
    }

    // 5. Assurance expire dans < 30 jours (MEDIUM)
    if (insuranceDoc?.expiry_date) {
      const expiryDate = new Date(insuranceDoc.expiry_date);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
        return NextResponse.json({
          message: `Votre attestation d'assurance expire le ${expiryDate.toLocaleDateString("fr-FR")}. Pensez à la renouveler !`,
          action: { label: "Renouveler", href: "/tenant/documents" },
          priority: "medium",
        } satisfies TipResponse);
      }
    }

    // 6. KYC non vérifié (MEDIUM)
    const kycStatus = tenantProfile?.kyc_status;
    if (kycStatus && kycStatus !== "verified") {
      return NextResponse.json({
        message: "Complétez votre vérification d'identité pour débloquer toutes les fonctionnalités de votre espace.",
        action: { label: "Vérifier", href: "/tenant/profile" },
        priority: "medium",
      } satisfies TipResponse);
    }

    // 7. Documents manquants (LOW)
    const docTypes = new Set(documents.map((d: any) => d.type));
    const missingDocs: string[] = [];
    if (!docTypes.has("piece_identite")) missingDocs.push("pièce d'identité");
    if (!docTypes.has("justificatif_domicile")) missingDocs.push("justificatif de domicile");

    if (missingDocs.length > 0 && activeLeases.length > 0) {
      return NextResponse.json({
        message: `Ajoutez votre ${missingDocs[0]} pour compléter votre dossier locataire et améliorer votre score.`,
        action: { label: "Ajouter", href: "/tenant/documents" },
        priority: "low",
      } satisfies TipResponse);
    }

    // 8. Compteurs non relevés (LOW)
    if (meterLeases.length > 0) {
      const propertyIds = meterLeases
        .map((ls: any) => ls.leases?.property_id)
        .filter(Boolean);

      if (propertyIds.length > 0) {
        const { data: meters } = await service
          .from("meters")
          .select("id")
          .in("property_id", propertyIds)
          .eq("is_active", true);

        if (meters && meters.length > 0) {
          const meterIds = meters.map((m: any) => m.id);
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          const { data: recentReadings } = await service
            .from("meter_readings")
            .select("meter_id")
            .in("meter_id", meterIds)
            .gte("reading_date", threeMonthsAgo.toISOString().split("T")[0]);

          const metersWithRecentReading = new Set(
            (recentReadings || []).map((r: any) => r.meter_id)
          );
          const staleMeters = meterIds.filter((id: string) => !metersWithRecentReading.has(id));

          if (staleMeters.length > 0) {
            return NextResponse.json({
              message: "Pensez à relever vos compteurs ! Certains n'ont pas été mis à jour depuis plus de 3 mois.",
              action: { label: "Mes compteurs", href: "/tenant/meters" },
              priority: "low",
            } satisfies TipResponse);
          }
        }
      }
    }

    // 9. Défaut — tout est en ordre
    return NextResponse.json({
      message: "Tout est en ordre ! Pensez à vérifier régulièrement vos relevés de compteurs pour suivre votre consommation.",
      action: { label: "Mes compteurs", href: "/tenant/meters" },
      priority: "low",
    } satisfies TipResponse);
  } catch (error: unknown) {
    console.error("[Tips API] Erreur:", error);
    return NextResponse.json({
      message: "Tout est en ordre ! Pensez à vérifier régulièrement vos relevés de compteurs pour suivre votre consommation.",
      action: { label: "Mes compteurs", href: "/tenant/meters" },
      priority: "low",
    } satisfies TipResponse);
  }
}
