/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Teste la connectivité d'un provider d'API externe (envoie un email test via le provider)
 * @usage POST /api/admin/integrations/providers/[id]/test
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";

// Fonction de déchiffrement
function decryptKey(encryptedKey: string): string {
  const masterKey = process.env.API_KEY_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "default-key-for-dev-only-32chars!";
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/admin/integrations/providers/[id]/test
 * Tester la connexion à un provider
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.integrations.providers.test");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const { id: providerId } = params;
    const auth = await requireAdminPermissions(request, ["admin.integrations.write"], {
      rateLimit: "adminCritical",
      auditAction: "Test provider connection",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    // Récupérer le provider
    const { data: provider, error: providerError } = await supabase
      .from("api_providers")
      .select("*")
      .eq("id", providerId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({ error: "Provider non trouvé" }, { status: 404 });
    }

    // Récupérer la credential (la plus récente pour ce provider)
    const { data: credential, error: credError } = await supabase
      .from("api_credentials")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (credError || !credential) {
      return NextResponse.json(
        { error: "Aucune clé API configurée pour ce provider" },
        { status: 400 }
      );
    }

    // Déchiffrer la clé (stockée dans secret_ref)
    let apiKey: string;
    try {
      apiKey = decryptKey(credential.secret_ref as string);
    } catch {
      return NextResponse.json(
        { error: "Impossible de déchiffrer la clé API" },
        { status: 500 }
      );
    }

    // Récupérer la config (stockée dans scope comme JSON)
    let config: any = {};
    try {
      if (credential.scope) {
        config = JSON.parse(credential.scope as string);
      }
    } catch {
      // scope n'est pas du JSON, ignorer
    }

    // Tester selon le type de provider
    let testResult: { success: boolean; message: string; details?: any };

    switch ((provider.name as string).toLowerCase()) {
      case "resend":
        testResult = await testResend(apiKey, auth.user.email, config);
        break;
      case "stripe":
        testResult = await testStripe(apiKey);
        break;
      case "twilio":
        testResult = await testTwilio(apiKey, config);
        break;
      default:
        testResult = { success: true, message: "Provider non testable automatiquement" };
    }

    // Logger le test
    await supabase.from("audit_log").insert({
      user_id: auth.user.id,
      action: "provider_tested",
      entity_type: "api_provider",
      entity_id: providerId,
      metadata: { 
        provider_name: provider.name, 
        success: testResult.success,
        message: testResult.message,
      },
    });

    return NextResponse.json(testResult);
  } catch (error: unknown) {
    console.error("Erreur test provider:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function testResend(_apiKey: string, adminEmail: string | undefined, _config: any): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const to = adminEmail || "delivered@resend.dev";
    const template = emailTemplates.integrationTest
      ? emailTemplates.integrationTest({ testDate: new Date().toLocaleString("fr-FR") })
      : {
          subject: "Test de configuration Resend - Talok",
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #10b981;">Configuration Resend réussie !</h2><p>Votre intégration email fonctionne correctement.</p><p style="color: #64748b; font-size: 14px;">Test effectué le ${new Date().toLocaleString("fr-FR")}</p></div>`,
        };

    const result = await sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      tags: [{ name: "type", value: "integration_test" }],
    });

    if (!result.success) {
      return { success: false, message: result.error || "Erreur Resend", details: result };
    }

    return {
      success: true,
      message: `Email de test envoyé à ${to}`,
      details: { messageId: result.messageId },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erreur de connexion à Resend",
    };
  }
}

// Test Stripe
async function testStripe(apiKey: string): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Erreur Stripe",
        details: error,
      };
    }

    const balance = await response.json();
    return {
      success: true,
      message: "Connexion Stripe OK",
      details: { 
        available: balance.available?.map((b: any) => `${b.amount / 100} ${b.currency.toUpperCase()}`),
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erreur de connexion à Stripe",
    };
  }
}

// Test Twilio
async function testTwilio(apiKey: string, config: any): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const accountSid = config?.account_sid;
    if (!accountSid) {
      return {
        success: false,
        message: "Account SID Twilio manquant dans la configuration",
      };
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${apiKey}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Erreur d'authentification Twilio",
      };
    }

    const account = await response.json();
    return {
      success: true,
      message: "Connexion Twilio OK",
      details: { 
        friendly_name: account.friendly_name,
        status: account.status,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erreur de connexion à Twilio",
    };
  }
}

