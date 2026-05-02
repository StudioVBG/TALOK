/**
 * Templates email pour les alertes assurance Talok
 */

import { INSURANCE_TYPE_LABELS } from "./constants";
import type { InsuranceType } from "./types";

interface InsuranceEmailParams {
  userName: string;
  insuranceType: InsuranceType;
  insurerName: string;
  endDate: string;
  policyNumber: string;
}

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getTypeLabel(type: InsuranceType): string {
  return INSURANCE_TYPE_LABELS[type] || type;
}

/**
 * Email J-30 : assurance expire dans 30 jours
 */
export function insuranceExpiry30jEmail(params: InsuranceEmailParams) {
  const typeLabel = getTypeLabel(params.insuranceType);
  const dateFormatted = formatDateFR(params.endDate);
  const subject = `Votre assurance ${typeLabel} expire bientot`;

  const html = `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center">
      <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">TALOK</span>
    </div>
    <div style="background:#fff;padding:40px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827">Votre assurance expire bientot</h1>
      <p style="color:#374151;font-size:16px;line-height:1.6">Bonjour ${params.userName},</p>
      <p style="color:#374151;font-size:16px;line-height:1.6">Votre assurance <strong>${typeLabel}</strong> aupres de <strong>${params.insurerName}</strong> arrive a echeance le <strong>${dateFormatted}</strong>.</p>
      ${params.policyNumber ? `<p style="color:#6b7280;font-size:14px">N° de contrat : ${params.policyNumber}</p>` : ""}
      <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0;color:#92400E;font-weight:600">Pensez a renouveler votre contrat avant le ${dateFormatted} pour eviter toute interruption de couverture.</p>
      </div>
      <a href="https://talok.fr/owner/insurance" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;margin:24px 0">Gerer mes assurances</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p>
    </div>
  </div>`;

  return { subject, html };
}

/**
 * Email J-7 : assurance expire dans 7 jours (urgent)
 */
export function insuranceExpiry7jEmail(params: InsuranceEmailParams) {
  const typeLabel = getTypeLabel(params.insuranceType);
  const dateFormatted = formatDateFR(params.endDate);
  const subject = `URGENT — Votre assurance ${typeLabel} expire dans 7 jours`;

  const html = `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#DC2626,#B91C1C);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center">
      <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">TALOK</span>
    </div>
    <div style="background:#fff;padding:40px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827">Votre assurance expire dans 7 jours</h1>
      <p style="color:#374151;font-size:16px;line-height:1.6">Bonjour ${params.userName},</p>
      <p style="color:#374151;font-size:16px;line-height:1.6">Votre assurance <strong>${typeLabel}</strong> aupres de <strong>${params.insurerName}</strong> expire le <strong>${dateFormatted}</strong>.</p>
      ${params.policyNumber ? `<p style="color:#6b7280;font-size:14px">N° de contrat : ${params.policyNumber}</p>` : ""}
      <div style="background:#FEE2E2;border-left:4px solid #EF4444;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0;color:#991B1B;font-weight:600">Action requise : renouvelez votre assurance immediatement pour eviter d'etre en defaut de couverture.</p>
      </div>
      <a href="https://talok.fr/owner/insurance" style="display:inline-block;background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;margin:24px 0">Renouveler maintenant</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p>
    </div>
  </div>`;

  return { subject, html };
}

/**
 * Email alerte proprio : locataire sans assurance valide
 */
export function tenantInsuranceMissingEmail(params: {
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
}) {
  const subject = `Alerte — ${params.tenantName} n'a pas d'assurance habitation valide`;

  const html = `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center">
      <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">TALOK</span>
    </div>
    <div style="background:#fff;padding:40px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827">Assurance locataire manquante</h1>
      <p style="color:#374151;font-size:16px;line-height:1.6">Bonjour ${params.ownerName},</p>
      <p style="color:#374151;font-size:16px;line-height:1.6">Votre locataire <strong>${params.tenantName}</strong> au <strong>${params.propertyAddress}</strong> n'a pas fourni d'attestation d'assurance habitation valide.</p>
      <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0;color:#92400E;font-weight:600">L'assurance multirisques habitation est obligatoire pour tout locataire. Vous pouvez lui envoyer un rappel depuis Talok.</p>
      </div>
      <a href="https://talok.fr/owner/insurance" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;margin:24px 0">Voir les assurances</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p>
    </div>
  </div>`;

  return { subject, html };
}
