export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/notice/letter - Générer la lettre de congé PDF
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
    const serviceClient = getServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;

    // Récupérer le bail et le congé
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        type_bail,
        date_debut,
        loyer,
        charges_forfaitaires,
        depot_garantie,
        property:properties!inner(
          adresse_complete,
          code_postal,
          ville
        ),
        signers:lease_signers(
          role,
          profile:profiles(id, prenom, nom, email, user_id)
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    // Récupérer le congé
    const { data: notice, error: noticeError } = await serviceClient
      .from("lease_notices")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (noticeError || !notice) {
      return NextResponse.json({ error: "Congé non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const tenantSigner = leaseData.signers?.find(
      (s: any) => s.role === "locataire_principal" && s.profile?.user_id === user.id
    );
    const ownerSigner = leaseData.signers?.find(
      (s: any) => (s.role === "proprietaire" || s.role === "bailleur")
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = (profile as any)?.role === "admin";
    const isTenant = !!tenantSigner;
    const isOwner = leaseData.property?.owner_id === (profile as any)?.id;

    if (!isTenant && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Générer le HTML de la lettre
    const tenant = tenantSigner?.profile || { prenom: "", nom: "" };
    const owner = ownerSigner?.profile || { prenom: "", nom: "" };
    const property = leaseData.property;
    const noticeData = notice as any;

    const REDUCED_REASON_LABELS: Record<string, string> = {
      mutation_professionnelle: "mutation professionnelle",
      perte_emploi: "perte d'emploi",
      nouvel_emploi: "nouvel emploi consécutif à une perte d'emploi",
      raison_sante: "état de santé justifiant un changement de domicile",
      rsa_beneficiaire: "bénéficiaire du RSA",
      aah_beneficiaire: "bénéficiaire de l'AAH",
      zone_tendue: "logement situé en zone tendue",
      premier_emploi: "premier emploi",
      violence_conjugale: "situation de violence conjugale",
    };

    const formatDateLong = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <style>
          @page { 
            size: A4; 
            margin: 25mm 20mm;
          }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #1a1a1a;
            max-width: 210mm;
            margin: 0 auto;
          }
          .header {
            margin-bottom: 40px;
          }
          .sender {
            margin-bottom: 30px;
          }
          .sender p {
            margin: 2px 0;
          }
          .recipient {
            text-align: right;
            margin-bottom: 30px;
          }
          .recipient p {
            margin: 2px 0;
          }
          .location-date {
            text-align: right;
            margin-bottom: 30px;
          }
          .subject {
            margin-bottom: 30px;
          }
          .subject strong {
            text-decoration: underline;
          }
          .reference {
            font-size: 10pt;
            color: #666;
            margin-bottom: 20px;
          }
          .body-text {
            text-align: justify;
            margin-bottom: 15px;
          }
          .body-text p {
            margin-bottom: 15px;
          }
          .highlight-box {
            background: #f8f9fa;
            border-left: 4px solid #3b82f6;
            padding: 15px 20px;
            margin: 25px 0;
          }
          .highlight-box p {
            margin: 5px 0;
          }
          .signature-block {
            margin-top: 50px;
          }
          .signature-line {
            margin-top: 60px;
            border-top: 1px solid #333;
            width: 200px;
          }
          .footer-note {
            font-size: 9pt;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          .legal-ref {
            font-style: italic;
            font-size: 10pt;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="sender">
            <p><strong>${tenant.prenom} ${tenant.nom}</strong></p>
            <p>${property.adresse_complete}</p>
            <p>${property.code_postal} ${property.ville}</p>
          </div>

          <div class="recipient">
            <p><strong>${owner.prenom} ${owner.nom}</strong></p>
            <p><em>Bailleur</em></p>
          </div>

          <div class="location-date">
            <p>${property.ville}, le ${formatDateLong(noticeData.notice_date)}</p>
          </div>
        </div>

        <div class="subject">
          <p><strong>Objet : Congé du logement sis ${property.adresse_complete}, ${property.code_postal} ${property.ville}</strong></p>
        </div>

        <div class="reference">
          <p>Lettre recommandée avec accusé de réception</p>
        </div>

        <div class="body-text">
          <p>Madame, Monsieur,</p>

          <p>
            Par la présente, je vous informe de ma décision de mettre fin au contrat de location 
            du logement situé au <strong>${property.adresse_complete}, ${property.code_postal} ${property.ville}</strong>, 
            dont je suis locataire depuis le ${formatDateLong(leaseData.date_debut)}.
          </p>

          ${noticeData.is_reduced_notice && noticeData.reduced_notice_reason ? `
          <p>
            Conformément à l'article 15 de la loi du 6 juillet 1989, je sollicite le bénéfice 
            du préavis réduit d'un mois en raison de : <strong>${REDUCED_REASON_LABELS[noticeData.reduced_notice_reason] || noticeData.reduced_notice_reason}</strong>.
          </p>
          <p class="legal-ref">
            Je m'engage à fournir les justificatifs correspondants sur demande.
          </p>
          ` : `
          <p>
            Conformément aux dispositions légales en vigueur, je respecterai le préavis 
            de ${noticeData.notice_period_days} jours applicable à ce type de bail.
          </p>
          `}

          <div class="highlight-box">
            <p><strong>Date de prise d'effet du congé :</strong> ${formatDateLong(noticeData.notice_date)}</p>
            <p><strong>Date de fin du bail :</strong> ${formatDateLong(noticeData.effective_end_date)}</p>
            <p><strong>Durée du préavis :</strong> ${noticeData.notice_period_days} jours</p>
          </div>

          <p>
            Je reste à votre disposition pour convenir d'une date afin de réaliser 
            l'état des lieux de sortie et vous remettre les clés du logement.
          </p>

          ${noticeData.forwarding_address ? `
          <p>
            Je vous communique ma nouvelle adresse pour toute correspondance ultérieure 
            et notamment pour la restitution du dépôt de garantie :
          </p>
          <p style="padding-left: 30px; font-style: italic;">
            ${noticeData.forwarding_address.replace(/\n/g, '<br>')}
          </p>
          ` : ''}

          <p>
            Je vous rappelle que le dépôt de garantie, d'un montant de 
            <strong>${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(leaseData.depot_garantie || 0)}</strong>, 
            devra m'être restitué dans les délais légaux, sous déduction des éventuelles 
            sommes restant dues ou des réparations locatives dûment justifiées.
          </p>

          <p>
            Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.
          </p>
        </div>

        <div class="signature-block">
          <p>${tenant.prenom} ${tenant.nom}</p>
          <div class="signature-line"></div>
          <p><em>Signature</em></p>
        </div>

        <div class="footer-note">
          <p>
            <strong>Important :</strong> Cette lettre doit être envoyée par lettre recommandée 
            avec accusé de réception. La date de réception par le bailleur fait foi pour 
            le calcul du préavis.
          </p>
          <p>
            Références légales : Loi n° 89-462 du 6 juillet 1989, articles 12 et 15.
          </p>
        </div>
      </body>
      </html>
    `;

    // Retourner le HTML (le frontend peut l'imprimer ou le convertir en PDF)
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="lettre_conge_${leaseId}.html"`,
      },
    });
  } catch (error: unknown) {
    console.error("[notice/letter] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

