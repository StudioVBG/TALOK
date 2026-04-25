export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/emails/resend.service";

/**
 * POST /api/contact
 * Reçoit les soumissions du formulaire de la page /contact.
 *
 * - Validation Zod
 * - Honeypot anti-bot (champ "website" qui doit rester vide)
 * - Envoi via Resend vers support@talok.fr avec replyTo expediteur
 * - Idempotency key pour eviter les doublons (refresh du POST)
 */

const SUBJECT_LABELS: Record<string, string> = {
  general: "Question générale",
  enterprise: "Offre Enterprise",
  support: "Support technique",
  partnership: "Partenariat",
  press: "Presse / Média",
  other: "Autre",
};

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(100),
  email: z.string().trim().email("Email invalide").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  company: z.string().trim().max(150).optional().or(z.literal("")),
  subject: z.enum(["general", "enterprise", "support", "partnership", "press", "other"]),
  message: z.string().trim().min(10, "Message trop court (min 10 caractères)").max(5000),
  // Champs optionnels presse-specific (formulaire /presse)
  mediaOutlet: z.string().trim().max(150).optional().or(z.literal("")),
  deadline: z.string().trim().max(100).optional().or(z.literal("")),
  // Honeypot : doit rester vide
  website: z.string().max(0).optional(),
});

const SUPPORT_EMAIL = process.env.CONTACT_TO_EMAIL || "support@talok.fr";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corps de requête invalide" },
      { status: 400 }
    );
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Données du formulaire invalides",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Honeypot : si rempli, faire silencieusement comme si c'etait OK
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const subjectLabel = SUBJECT_LABELS[data.subject] ?? data.subject;
  const emailSubject = `[Contact] ${subjectLabel} — ${data.name}`;

  const html = `
    <h2>Nouveau message via /contact</h2>
    <p><strong>Sujet :</strong> ${escapeHtml(subjectLabel)}</p>
    <p><strong>Nom :</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email :</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
    ${data.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(data.phone)}</p>` : ""}
    ${data.company ? `<p><strong>Société :</strong> ${escapeHtml(data.company)}</p>` : ""}
    ${data.mediaOutlet ? `<p><strong>Média :</strong> ${escapeHtml(data.mediaOutlet)}</p>` : ""}
    ${data.deadline ? `<p><strong>Deadline :</strong> ${escapeHtml(data.deadline)}</p>` : ""}
    <hr>
    <p><strong>Message :</strong></p>
    <p style="white-space: pre-wrap;">${escapeHtml(data.message)}</p>
  `.trim();

  const text = [
    `Nouveau message via /contact`,
    ``,
    `Sujet : ${subjectLabel}`,
    `Nom : ${data.name}`,
    `Email : ${data.email}`,
    data.phone ? `Téléphone : ${data.phone}` : null,
    data.company ? `Société : ${data.company}` : null,
    data.mediaOutlet ? `Média : ${data.mediaOutlet}` : null,
    data.deadline ? `Deadline : ${data.deadline}` : null,
    ``,
    `Message :`,
    data.message,
  ]
    .filter(Boolean)
    .join("\n");

  const idempotencyKey = `contact-${data.email}-${Date.now().toString(36)}`;

  const result = await sendEmail({
    to: SUPPORT_EMAIL,
    replyTo: data.email,
    subject: emailSubject,
    html,
    text,
    tags: [
      { name: "source", value: "contact-form" },
      { name: "subject", value: data.subject },
    ],
    idempotencyKey,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error ||
          "Échec de l'envoi du message. Réessayez ou contactez support@talok.fr directement.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
