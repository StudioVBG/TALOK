export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/emails/resend.service";
import { NextResponse } from "next/server";

/**
 * Configuration des préavis selon le type de bail (en jours)
 * Source: Loi ALUR et Code civil
 */
const NOTICE_PERIODS: Record<string, { standard: number; reduced: number; label: string }> = {
  nu: { standard: 90, reduced: 30, label: "Location nue" },           // 3 mois, 1 mois en zone tendue
  meuble: { standard: 30, reduced: 30, label: "Location meublée" },   // 1 mois
  colocation: { standard: 30, reduced: 30, label: "Colocation" },     // 1 mois
  saisonnier: { standard: 0, reduced: 0, label: "Saisonnier" },       // Pas de préavis
  mobilite: { standard: 30, reduced: 30, label: "Bail mobilité" },    // 1 mois
};

/**
 * Motifs légaux pour préavis réduit (location nue)
 * Article 15 de la loi du 6 juillet 1989
 */
const REDUCED_NOTICE_REASONS = [
  "mutation_professionnelle",
  "perte_emploi",
  "nouvel_emploi",
  "raison_sante",
  "rsa_beneficiaire",
  "aah_beneficiaire",
  "zone_tendue",
  "premier_emploi",
  "violence_conjugale",
];

/**
 * GET /api/leases/[id]/notice - Vérifier les conditions de congé
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;

    // Récupérer le bail
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        type_bail,
        statut,
        date_debut,
        date_fin,
        loyer,
        charges_forfaitaires,
        depot_garantie,
        property:properties!inner(
          id,
          owner_id,
          adresse_complete,
          ville,
          code_postal,
          zone_tendue
        ),
        signers:lease_signers(
          id,
          role,
          profile_id,
          profile:profiles(id, prenom, nom, email, user_id)
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est bien locataire de ce bail
    const leaseData = lease as any;
    const tenantSigner = leaseData.signers?.find(
      (s: any) => s.role === "locataire_principal" && s.profile?.user_id === user.id
    );

    if (!tenantSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas locataire de ce bail" },
        { status: 403 }
      );
    }

    // Vérifier que le bail est actif
    if (leaseData.statut !== "active") {
      return NextResponse.json(
        { error: "Seul un bail actif peut faire l'objet d'un congé" },
        { status: 400 }
      );
    }

    // Calculer les conditions de préavis
    const noticePeriod = NOTICE_PERIODS[leaseData.type_bail] || NOTICE_PERIODS.meuble;
    const isZoneTendue = leaseData.property?.zone_tendue === true;
    
    // Durée du préavis applicable
    const standardNoticeDays = noticePeriod.standard;
    const reducedNoticeDays = noticePeriod.reduced;
    const canHaveReducedNotice = leaseData.type_bail === "nu" && standardNoticeDays !== reducedNoticeDays;

    // Calculer les dates
    const today = new Date();
    const standardEndDate = new Date(today);
    standardEndDate.setDate(standardEndDate.getDate() + standardNoticeDays);
    
    const reducedEndDate = new Date(today);
    reducedEndDate.setDate(reducedEndDate.getDate() + reducedNoticeDays);

    // Récupérer le propriétaire
    const owner = leaseData.signers?.find((s: any) => s.role === "proprietaire" || s.role === "bailleur");

    return NextResponse.json({
      lease: {
        id: leaseData.id,
        type_bail: leaseData.type_bail,
        type_bail_label: noticePeriod.label,
        date_debut: leaseData.date_debut,
        loyer: leaseData.loyer,
        charges: leaseData.charges_forfaitaires,
        depot_garantie: leaseData.depot_garantie,
      },
      property: {
        adresse: leaseData.property?.adresse_complete,
        ville: leaseData.property?.ville,
        code_postal: leaseData.property?.code_postal,
        zone_tendue: isZoneTendue,
      },
      owner: owner?.profile ? {
        prenom: owner.profile.prenom,
        nom: owner.profile.nom,
        email: owner.profile.email,
      } : null,
      tenant: {
        prenom: tenantSigner.profile?.prenom,
        nom: tenantSigner.profile?.nom,
        email: tenantSigner.profile?.email,
      },
      notice_conditions: {
        standard_days: standardNoticeDays,
        reduced_days: reducedNoticeDays,
        can_have_reduced: canHaveReducedNotice,
        is_zone_tendue: isZoneTendue,
        standard_end_date: standardEndDate.toISOString().split("T")[0],
        reduced_end_date: reducedEndDate.toISOString().split("T")[0],
        reduced_reasons: canHaveReducedNotice ? REDUCED_NOTICE_REASONS : [],
      },
    });
  } catch (error: unknown) {
    console.error("[notice] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/notice - Donner congé (locataire)
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;
    const body = await request.json();

    const {
      notice_date,          // Date d'envoi du congé
      end_date,             // Date de fin souhaitée
      reason,               // Motif (optionnel pour meublé, obligatoire pour préavis réduit)
      reduced_notice,       // Demande de préavis réduit
      forwarding_address,   // Nouvelle adresse
      notes,                // Commentaires additionnels
    } = body;

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        type_bail,
        statut,
        date_debut,
        loyer,
        charges_forfaitaires,
        depot_garantie,
        property:properties!inner(
          id,
          owner_id,
          adresse_complete,
          ville,
          code_postal,
          zone_tendue
        ),
        signers:lease_signers(
          id,
          role,
          profile_id,
          profile:profiles(id, prenom, nom, email, user_id)
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    // Vérifier que l'utilisateur est bien locataire de ce bail
    const tenantSigner = leaseData.signers?.find(
      (s: any) => s.role === "locataire_principal" && s.profile?.user_id === user.id
    );

    if (!tenantSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas locataire de ce bail" },
        { status: 403 }
      );
    }

    // Vérifier que le bail est actif
    if (leaseData.statut !== "active") {
      return NextResponse.json(
        { error: "Seul un bail actif peut faire l'objet d'un congé" },
        { status: 400 }
      );
    }

    // Valider le préavis réduit si demandé
    const noticePeriod = NOTICE_PERIODS[leaseData.type_bail] || NOTICE_PERIODS.meuble;
    if (reduced_notice && leaseData.type_bail === "nu") {
      if (!reason || !REDUCED_NOTICE_REASONS.includes(reason)) {
        return NextResponse.json(
          { error: "Motif valide requis pour le préavis réduit" },
          { status: 400 }
        );
      }
    }

    // Calculer la date de fin effective
    const noticeStartDate = new Date(notice_date || new Date());
    const noticeDays = reduced_notice ? noticePeriod.reduced : noticePeriod.standard;
    const effectiveEndDate = new Date(noticeStartDate);
    effectiveEndDate.setDate(effectiveEndDate.getDate() + noticeDays);

    // Créer l'enregistrement de congé
    const { data: notice, error: noticeError } = await serviceClient
      .from("lease_notices")
      .insert({
        lease_id: leaseId,
        tenant_profile_id: tenantSigner.profile_id,
        notice_date: noticeStartDate.toISOString().split("T")[0],
        effective_end_date: effectiveEndDate.toISOString().split("T")[0],
        notice_period_days: noticeDays,
        is_reduced_notice: !!reduced_notice,
        reduced_notice_reason: reduced_notice ? reason : null,
        forwarding_address,
        notes,
        status: "pending", // pending, acknowledged, completed
        created_by: user.id,
      })
      .select()
      .single();

    if (noticeError) {
      // Si la table n'existe pas, la créer via migration
      if (noticeError.code === "42P01") {
        console.error("[notice] Table lease_notices manquante, création nécessaire");
        return NextResponse.json(
          { error: "Configuration en cours, veuillez réessayer" },
          { status: 503 }
        );
      }
      throw noticeError;
    }

    // Mettre à jour le bail avec le statut "notice_given"
    await serviceClient
      .from("leases")
      .update({
        statut: "notice_given",
        date_fin: effectiveEndDate.toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", leaseId);

    // Récupérer le propriétaire pour la notification
    const owner = leaseData.signers?.find((s: any) => s.role === "proprietaire" || s.role === "bailleur");

    // Notifier le propriétaire (in-app + email)
    if (owner?.profile?.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: owner.profile.user_id,
        type: "lease_notice",
        title: "📬 Congé reçu",
        body: `${tenantSigner.profile?.prenom} ${tenantSigner.profile?.nom} a donné congé pour le logement ${leaseData.property?.adresse_complete}. Fin du bail prévue le ${effectiveEndDate.toLocaleDateString("fr-FR")}.`,
        priority: "high",
        metadata: {
          lease_id: leaseId,
          notice_id: notice?.id,
          end_date: effectiveEndDate.toISOString().split("T")[0],
        },
      });

      if (owner.profile.email) {
        const tenantFullName = `${tenantSigner.profile?.prenom ?? ""} ${tenantSigner.profile?.nom ?? ""}`.trim() || "Le locataire";
        await sendEmail({
          to: owner.profile.email,
          subject: `Congé reçu — ${leaseData.property?.adresse_complete ?? "votre bien"}`,
          html: `
            <p>Bonjour ${owner.profile.prenom ?? ""},</p>
            <p><strong>${tenantFullName}</strong> vient de donner congé pour le logement situé au <strong>${leaseData.property?.adresse_complete ?? ""}</strong>.</p>
            <ul>
              <li>Date de notification : ${noticeStartDate.toLocaleDateString("fr-FR")}</li>
              <li>Fin de bail prévue : <strong>${effectiveEndDate.toLocaleDateString("fr-FR")}</strong></li>
              <li>Préavis : ${noticeDays} jours${reduced_notice ? " (réduit, motif : " + (reason ?? "") + ")" : ""}</li>
            </ul>
            <p>Vous pouvez consulter le préavis et préparer la sortie depuis votre espace Talok :</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr"}/owner/leases/${leaseId}">Voir le bail</a></p>
            <p>—<br/>L'équipe Talok</p>
          `,
          idempotencyKey: `lease-notice/${notice?.id ?? leaseId}/owner`,
          tags: [{ name: "type", value: "lease_notice" }],
        }).catch((err) => {
          console.error("[notice] email owner failed:", err);
        });
      }
    }

    // Confirmation par email au locataire
    if (tenantSigner.profile?.email) {
      const ownerName = owner?.profile
        ? `${owner.profile.prenom ?? ""} ${owner.profile.nom ?? ""}`.trim()
        : "votre propriétaire";
      await sendEmail({
        to: tenantSigner.profile.email,
        subject: "Préavis enregistré — confirmation",
        html: `
          <p>Bonjour ${tenantSigner.profile.prenom ?? ""},</p>
          <p>Votre préavis pour le logement <strong>${leaseData.property?.adresse_complete ?? ""}</strong> a bien été enregistré.</p>
          <ul>
            <li>Date de notification : ${noticeStartDate.toLocaleDateString("fr-FR")}</li>
            <li>Fin de bail effective : <strong>${effectiveEndDate.toLocaleDateString("fr-FR")}</strong></li>
            <li>Préavis : ${noticeDays} jours${reduced_notice ? " (réduit, motif : " + (reason ?? "") + ")" : ""}</li>
          </ul>
          <p>Votre propriétaire (${ownerName}) a été automatiquement notifié.</p>
          <p>Pensez à organiser l'état des lieux de sortie avec lui avant cette date.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr"}/tenant/lease">Voir mon bail</a></p>
          <p>—<br/>L'équipe Talok</p>
        `,
        idempotencyKey: `lease-notice/${notice?.id ?? leaseId}/tenant`,
        tags: [{ name: "type", value: "lease_notice_confirmation" }],
      }).catch((err) => {
        console.error("[notice] email tenant failed:", err);
      });
    }

    // Émettre un événement pour le workflow
    await serviceClient.from("outbox").insert({
      event_type: "Lease.NoticeGiven",
      payload: {
        lease_id: leaseId,
        notice_id: notice?.id,
        tenant_id: tenantSigner.profile_id,
        owner_id: leaseData.property?.owner_id,
        notice_date: noticeStartDate.toISOString().split("T")[0],
        effective_end_date: effectiveEndDate.toISOString().split("T")[0],
        notice_period_days: noticeDays,
        is_reduced_notice: !!reduced_notice,
        reason: reason,
      },
    });

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_notice_given",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        notice_id: notice?.id,
        notice_date: noticeStartDate.toISOString().split("T")[0],
        effective_end_date: effectiveEndDate.toISOString().split("T")[0],
        notice_period_days: noticeDays,
        is_reduced_notice: !!reduced_notice,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Congé enregistré avec succès",
      notice: {
        id: notice?.id,
        notice_date: noticeStartDate.toISOString().split("T")[0],
        effective_end_date: effectiveEndDate.toISOString().split("T")[0],
        notice_period_days: noticeDays,
        is_reduced_notice: !!reduced_notice,
      },
    });
  } catch (error: unknown) {
    console.error("[notice] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
