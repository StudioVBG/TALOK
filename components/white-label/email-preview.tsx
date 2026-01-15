"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Monitor,
  Smartphone,
  ChevronDown,
  Eye,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { OrganizationBranding, DEFAULT_BRANDING } from "@/lib/white-label/types";

// ============================================
// TYPES
// ============================================

type EmailTemplate = "welcome" | "invoice" | "payment" | "reminder" | "ticket";
type DeviceMode = "desktop" | "mobile";

interface EmailPreviewProps {
  branding: Partial<OrganizationBranding>;
  className?: string;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const EMAIL_TEMPLATES: Record<EmailTemplate, { name: string; subject: string }> = {
  welcome: { name: "Bienvenue", subject: "Bienvenue sur {{companyName}} !" },
  invoice: { name: "Nouvelle facture", subject: "Votre facture de loyer - {{month}}" },
  payment: { name: "Paiement reçu", subject: "Confirmation de paiement" },
  reminder: { name: "Rappel", subject: "Rappel : Loyer en attente" },
  ticket: { name: "Ticket", subject: "Nouveau ticket de maintenance" },
};

// ============================================
// GENERATOR
// ============================================

function generateEmailHTML(
  template: EmailTemplate,
  branding: Partial<OrganizationBranding>
): string {
  const companyName = branding.company_name || DEFAULT_BRANDING.company_name || "Talok";
  const logoUrl = branding.email_logo_url || branding.logo_url;
  const primaryColor = branding.email_primary_color || branding.primary_color || DEFAULT_BRANDING.primary_color;
  const footerHtml = branding.email_footer_html;
  const removePoweredBy = branding.remove_powered_by || false;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px;" />`
    : `<h1 style="color: ${primaryColor}; font-size: 24px; margin: 0;">🏠 ${companyName}</h1>`;

  const footerContent = footerHtml || `
    <p style="margin: 0; color: #6b7280;">
      ${companyName}<br>
      Gestion locative simplifiée
    </p>
  `;

  const poweredBy = removePoweredBy
    ? ""
    : `<p style="margin: 16px 0 0 0; font-size: 11px; color: #9ca3af;">
        Propulsé par <a href="https://talok.fr" style="color: #9ca3af;">Talok</a>
      </p>`;

  const templateContents: Record<EmailTemplate, string> = {
    welcome: `
      <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Bienvenue chez ${companyName} !</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour Jean,
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
        Nous sommes ravis de vous accueillir sur notre plateforme de gestion locative.
        Votre compte a été créé avec succès et vous pouvez dès maintenant accéder à votre espace personnel.
      </p>
      <a href="#" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Accéder à mon espace
      </a>
    `,
    invoice: `
      <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Nouvelle facture disponible</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour Marie,
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
        Votre facture de loyer pour le mois de janvier 2026 est disponible.
      </p>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Période</td>
            <td style="text-align: right; color: #1f2937; font-weight: 500;">Janvier 2026</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Montant</td>
            <td style="text-align: right; color: #1f2937; font-weight: 600; font-size: 18px;">850,00 €</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Échéance</td>
            <td style="text-align: right; color: #1f2937;">5 janvier 2026</td>
          </tr>
        </table>
      </div>
      <a href="#" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Payer maintenant
      </a>
    `,
    payment: `
      <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Paiement reçu ✓</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour Pierre,
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
        Nous avons bien reçu votre paiement. Merci !
      </p>
      <div style="background: #dcfce7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; text-align: center;">
        <p style="margin: 0; color: #16a34a; font-weight: 600; font-size: 24px;">850,00 €</p>
        <p style="margin: 8px 0 0 0; color: #166534; font-size: 14px;">Payé le 3 janvier 2026</p>
      </div>
      <a href="#" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Voir le reçu
      </a>
    `,
    reminder: `
      <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Rappel : Loyer en attente</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour Sophie,
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
        Nous n'avons pas encore reçu votre paiement pour le mois de janvier 2026.
        Le montant de <strong>850,00 €</strong> était dû le 5 janvier.
      </p>
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          ⚠️ Retard de 5 jours
        </p>
      </div>
      <a href="#" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Régulariser maintenant
      </a>
    `,
    ticket: `
      <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Nouveau ticket de maintenance</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour,
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
        Un nouveau ticket de maintenance a été créé pour votre bien.
      </p>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border-left: 4px solid ${primaryColor};">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">Fuite robinet cuisine</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          Le robinet de la cuisine fuit depuis ce matin. L'eau coule en continu même quand le robinet est fermé.
        </p>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">
          Créé par Marie Martin · Il y a 2 heures
        </p>
      </div>
      <a href="#" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Voir le ticket
      </a>
    `,
  };

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${EMAIL_TEMPLATES[template].subject.replace("{{companyName}}", companyName)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); padding: 32px;">
              ${templateContents[template]}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              ${footerContent}
              ${poweredBy}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ============================================
// COMPONENT
// ============================================

export function EmailPreview({ branding, className }: EmailPreviewProps) {
  const [template, setTemplate] = useState<EmailTemplate>("welcome");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const emailHTML = generateEmailHTML(template, branding);
  const companyName = branding.company_name || DEFAULT_BRANDING.company_name || "Talok";

  return (
    <div className={cn("flex flex-col rounded-xl border border-slate-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-slate-400" />
          <Select value={template} onValueChange={(v) => setTemplate(v as EmailTemplate)}>
            <SelectTrigger className="w-48 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMAIL_TEMPLATES).map(([key, { name }]) => (
                <SelectItem key={key} value={key}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "p-1.5 rounded",
                device === "desktop" ? "bg-white shadow-sm" : "hover:bg-slate-200"
              )}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "p-1.5 rounded",
                device === "mobile" ? "bg-white shadow-sm" : "hover:bg-slate-200"
              )}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* View mode */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="preview" className="text-xs h-7">
                <Eye className="w-3 h-3 mr-1" />
                Aperçu
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs h-7">
                <Code className="w-3 h-3 mr-1" />
                HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Email header simulation */}
      <div className="p-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="text-xs">
            {branding.email_from_name || companyName}
          </Badge>
          <span className="text-slate-400">&lt;{branding.email_from_address || "noreply@talok.fr"}&gt;</span>
        </div>
        <p className="font-medium text-slate-900 mt-1">
          {EMAIL_TEMPLATES[template].subject
            .replace("{{companyName}}", companyName)
            .replace("{{month}}", "Janvier 2026")}
        </p>
      </div>

      {/* Preview area */}
      <div className="flex-1 bg-slate-100 p-4 overflow-auto" style={{ minHeight: 400 }}>
        {viewMode === "preview" ? (
          <motion.div
            layout
            className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
            style={{
              width: device === "mobile" ? 375 : "100%",
              maxWidth: device === "mobile" ? 375 : 700,
            }}
          >
            <iframe
              srcDoc={emailHTML}
              className="w-full border-0"
              style={{ minHeight: 500 }}
              title="Email preview"
            />
          </motion.div>
        ) : (
          <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
              {emailHTML}
            </pre>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
        Prévisualisation avec votre branding · {device === "mobile" ? "375px" : "600px max"}
      </div>
    </div>
  );
}

export default EmailPreview;
