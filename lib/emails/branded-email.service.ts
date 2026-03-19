/**
 * Service d'envoi d'emails avec branding dynamique
 *
 * Ce service permet d'envoyer des emails personnalisés avec le branding
 * de l'organisation (white-label).
 */

import { createClient } from "@/lib/supabase/server";
import { OrganizationBranding, DEFAULT_BRANDING } from "@/lib/white-label/types";
import { sendEmail } from "@/lib/services/email-service";
import type { EmailResult } from "@/lib/services/email-service";
import {
  normalizeResendFromAddress,
  resolveResendRuntimeConfig,
} from "@/lib/services/resend-config";

// ============================================
// TYPES
// ============================================

export interface BrandedEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  organizationId?: string;
  userId?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailBranding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footerHtml: string | null;
  removePoweredBy: boolean;
}

// ============================================
// SERVICE
// ============================================

export class BrandedEmailService {
  private supabase: Awaited<ReturnType<typeof createClient>>;

  constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  /**
   * Récupère le branding email pour une organisation
   */
  async getEmailBranding(organizationId?: string): Promise<EmailBranding> {
    const resendConfig = await resolveResendRuntimeConfig({ skipDatabase: true });
    const defaultBranding: EmailBranding = {
      companyName: "Talok",
      logoUrl: null,
      primaryColor: DEFAULT_BRANDING.primary_color!,
      fromName: "Talok",
      fromEmail: resendConfig.fromAddress,
      replyTo: resendConfig.replyTo,
      footerHtml: null,
      removePoweredBy: false,
    };

    if (!organizationId) {
      return defaultBranding;
    }

    const { data: org } = await this.supabase
      .from("organizations")
      .select(`
        name,
        white_label_level,
        branding:organization_branding(*)
      `)
      .eq("id", organizationId)
      .single();

    if (!org || !org.branding) {
      return defaultBranding;
    }

    const branding = org.branding as unknown as OrganizationBranding;
    const level = org.white_label_level;

    // Construire le branding selon le niveau
    return {
      companyName: branding.company_name || org.name || defaultBranding.companyName,
      logoUrl: branding.email_logo_url || branding.logo_url || defaultBranding.logoUrl,
      primaryColor: branding.email_primary_color || branding.primary_color || defaultBranding.primaryColor,
      fromName: branding.email_from_name || defaultBranding.fromName,
      fromEmail: branding.email_from_address || defaultBranding.fromEmail,
      replyTo: branding.email_reply_to || defaultBranding.replyTo,
      footerHtml: level !== "basic" ? branding.email_footer_html : null,
      removePoweredBy: level === "full" || level === "premium" ? branding.remove_powered_by : false,
    };
  }

  /**
   * Récupère le branding email pour un utilisateur
   */
  async getEmailBrandingForUser(userId: string): Promise<EmailBranding> {
    // Chercher l'organisation de l'utilisateur
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    return this.getEmailBranding(profile?.organization_id || undefined);
  }

  /**
   * Génère le wrapper HTML brandé pour un email
   */
  generateBrandedWrapper(
    content: string,
    branding: EmailBranding
  ): string {
    const logoHtml = branding.logoUrl
      ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" style="max-height: 50px; max-width: 200px; margin-bottom: 20px;" />`
      : `<h1 style="color: ${branding.primaryColor}; font-size: 24px; margin: 0 0 20px 0;">🏠 ${branding.companyName}</h1>`;

    const footerHtml = branding.footerHtml || `
      <p style="margin: 0; color: #6b7280;">
        ${branding.companyName}<br>
        Gestion locative simplifiée
      </p>
    `;

    const poweredByHtml = branding.removePoweredBy
      ? ""
      : `
        <p style="margin: 16px 0 0 0; font-size: 11px; color: #9ca3af;">
          Propulsé par <a href="https://talok.fr" style="color: #9ca3af;">Talok</a>
        </p>
      `;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${branding.companyName}</title>
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
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              ${footerHtml}
              ${poweredByHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Envoie un email brandé
   */
  async sendBrandedEmail(options: BrandedEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      let branding: EmailBranding;
      if (options.organizationId) {
        branding = await this.getEmailBranding(options.organizationId);
      } else if (options.userId) {
        branding = await this.getEmailBrandingForUser(options.userId);
      } else {
        branding = await this.getEmailBranding();
      }

      const brandedHtml = this.generateBrandedWrapper(options.html, branding);
      const brandedFrom = normalizeResendFromAddress(`${branding.fromName} <${branding.fromEmail}>`);

      const result: EmailResult = await sendEmail({
        to: options.to,
        subject: options.subject,
        html: brandedHtml,
        from: brandedFrom,
        replyTo: options.replyTo || branding.replyTo || undefined,
        tags: options.tags || [{ name: "type", value: "branded_email" }],
      });

      if (!result.success) {
        console.error("[BrandedEmail] Échec envoi:", result.error);
        return { success: false, error: result.error };
      }

      return { success: true, id: result.messageId };
    } catch (err) {
      console.error("[BrandedEmail] Exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    }
  }
}

// ============================================
// FACTORY
// ============================================

export async function createBrandedEmailService(): Promise<BrandedEmailService> {
  const supabase = await createClient();
  return new BrandedEmailService(supabase);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Envoie un email simple avec branding automatique
 */
export async function sendBrandedEmail(
  to: string | string[],
  subject: string,
  html: string,
  options?: {
    organizationId?: string;
    userId?: string;
    replyTo?: string;
    tags?: { name: string; value: string }[];
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const service = await createBrandedEmailService();
  return service.sendBrandedEmail({
    to,
    subject,
    html,
    ...options,
  });
}

/**
 * Génère un bouton CTA brandé
 */
export function generateBrandedButton(
  text: string,
  url: string,
  primaryColor: string = DEFAULT_BRANDING.primary_color!
): string {
  return `
    <a href="${url}" style="
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      margin: 16px 0;
    ">${text}</a>
  `.trim();
}

/**
 * Génère une section d'info brandée
 */
export function generateInfoSection(
  title: string,
  items: { label: string; value: string }[],
  primaryColor: string = DEFAULT_BRANDING.primary_color!
): string {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${item.label}</td>
          <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${item.value}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 12px 0; color: ${primaryColor}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">${title}</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>
    </div>
  `.trim();
}
