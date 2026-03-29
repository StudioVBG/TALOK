/**
 * Email de quittance de loyer au locataire
 *
 * Envoie la quittance PDF en pièce jointe après encaissement du loyer.
 * Conformité : art. 21 loi n° 89-462 du 6 juillet 1989
 */

import { sendEmail, type EmailResult } from "@/lib/emails/resend.service";

export interface SendReceiptEmailParams {
  tenantEmail: string;
  tenantName: string;
  period: string; // "YYYY-MM"
  totalAmount: number; // euros
  propertyAddress: string;
  paymentDate: string; // "YYYY-MM-DD"
  paymentMethod: string;
  pdfBytes: Uint8Array;
  paymentId: string; // pour idempotency key
}

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] || month;
  return `${monthName} ${year}`;
}

function formatDateFr(date: string): string {
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export async function sendReceiptEmail(
  params: SendReceiptEmailParams
): Promise<EmailResult> {
  const periodLabel = formatPeriod(params.period);
  const paymentDateLabel = formatDateFr(params.paymentDate);

  return sendEmail({
    to: params.tenantEmail,
    subject: `Votre quittance de loyer — ${periodLabel}`,
    html: `
      <div style="font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2563EB; margin-bottom: 16px;">Quittance de loyer</h2>
        <p>Bonjour ${escapeBasic(params.tenantName)},</p>
        <p>Votre loyer de <strong>${params.totalAmount.toFixed(2)}&nbsp;€</strong>
           pour la période de <strong>${escapeBasic(periodLabel)}</strong> a bien été encaissé
           le ${escapeBasic(paymentDateLabel)}.</p>
        <p>Vous trouverez votre quittance en pièce jointe de cet email.</p>
        <p>Ce document est également disponible dans votre
           <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/tenant/documents?type=quittance"
              style="color: #2563EB; text-decoration: underline;">espace documents</a>.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 13px;">
          Bien situé : ${escapeBasic(params.propertyAddress)}<br/>
          Ce document a valeur de quittance au sens de l'article 21 de la loi n° 89-462.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          Talok — talok.fr
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `quittance-${params.period}.pdf`,
        content: Buffer.from(params.pdfBytes),
      },
    ],
    idempotencyKey: `receipt-email/${params.paymentId}`,
    tags: [
      { name: "type", value: "receipt_email" },
      { name: "payment_id", value: params.paymentId },
    ],
  });
}

/** Minimal HTML escaping for user-provided strings */
function escapeBasic(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
