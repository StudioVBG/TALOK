/**
 * Service de retry pour les webhooks sortants
 *
 * Gère les échecs d'envoi de webhooks avec:
 * - Retry automatique avec backoff exponentiel
 * - Dead letter queue pour les échecs permanents
 * - Logging et monitoring
 *
 * @module lib/services/webhook-retry.service
 */

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Types
export interface WebhookPayload {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  target_url: string;
  headers?: Record<string, string>;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: "pending" | "processing" | "success" | "failed" | "dead_letter";
  created_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseBody?: string;
}

// Configuration
const DEFAULT_MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000; // 5 secondes
const MAX_DELAY_MS = 3600000; // 1 heure
const TIMEOUT_MS = 30000; // 30 secondes

/**
 * Calcule le délai de retry avec backoff exponentiel
 * Délais: 5s, 20s, 80s, 320s, 1280s (plafonné à 1h)
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = BASE_DELAY_MS * Math.pow(4, retryCount);
  return Math.min(delay, MAX_DELAY_MS);
}

/**
 * Envoie un webhook avec timeout
 */
async function sendWebhook(
  url: string,
  payload: Record<string, any>,
  headers?: Record<string, string>
): Promise<WebhookResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Talok-Webhook/1.0",
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        responseBody,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
      responseBody,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: `Timeout after ${TIMEOUT_MS}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Unknown error",
    };
  }
}

/**
 * Classe du service de retry webhook
 */
class WebhookRetryService {
  private supabase = createServiceRoleClient();

  /**
   * Enqueue un nouveau webhook pour envoi
   */
  async enqueue(
    eventType: string,
    payload: Record<string, any>,
    targetUrl: string,
    options?: {
      headers?: Record<string, string>;
      maxRetries?: number;
    }
  ): Promise<string> {
    const { headers, maxRetries = DEFAULT_MAX_RETRIES } = options || {};

    const { data, error } = await this.supabase
      .from("webhook_queue")
      .insert({
        event_type: eventType,
        payload,
        target_url: targetUrl,
        headers,
        max_retries: maxRetries,
        retry_count: 0,
        status: "pending",
        next_retry_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[WebhookRetry] Error enqueueing webhook:", error);
      throw new Error(`Failed to enqueue webhook: ${error.message}`);
    }

    console.log(`[WebhookRetry] Webhook enqueued: ${data.id} (${eventType})`);
    return data.id;
  }

  /**
   * Traite un webhook en attente
   */
  async processWebhook(webhook: WebhookPayload): Promise<boolean> {
    console.log(`[WebhookRetry] Processing webhook: ${webhook.id} (attempt ${webhook.retry_count + 1})`);

    // Marquer comme en cours de traitement
    await this.supabase
      .from("webhook_queue")
      .update({
        status: "processing",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", webhook.id);

    // Envoyer le webhook
    const result = await sendWebhook(webhook.target_url, webhook.payload, webhook.headers);

    if (result.success) {
      // Succès - marquer comme terminé
      await this.supabase
        .from("webhook_queue")
        .update({
          status: "success",
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", webhook.id);

      console.log(`[WebhookRetry] Webhook succeeded: ${webhook.id}`);
      return true;
    }

    // Échec - vérifier si on peut réessayer
    const newRetryCount = webhook.retry_count + 1;

    if (newRetryCount >= webhook.max_retries) {
      // Limite de retries atteinte - dead letter
      await this.supabase
        .from("webhook_queue")
        .update({
          status: "dead_letter",
          retry_count: newRetryCount,
          last_attempt_at: new Date().toISOString(),
          last_error: result.error,
        })
        .eq("id", webhook.id);

      console.error(`[WebhookRetry] Webhook moved to dead letter: ${webhook.id} - ${result.error}`);
      return false;
    }

    // Planifier le prochain retry
    const delayMs = calculateRetryDelay(newRetryCount);
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.supabase
      .from("webhook_queue")
      .update({
        status: "pending",
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt.toISOString(),
        last_attempt_at: new Date().toISOString(),
        last_error: result.error,
      })
      .eq("id", webhook.id);

    console.log(
      `[WebhookRetry] Webhook scheduled for retry: ${webhook.id} at ${nextRetryAt.toISOString()} (attempt ${newRetryCount + 1})`
    );
    return false;
  }

  /**
   * Récupère et traite les webhooks en attente
   * À appeler via un cron job
   */
  async processPendingWebhooks(batchSize: number = 10): Promise<number> {
    const now = new Date().toISOString();

    // Récupérer les webhooks prêts à être envoyés
    const { data: webhooks, error } = await this.supabase
      .from("webhook_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", now)
      .order("next_retry_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("[WebhookRetry] Error fetching pending webhooks:", error);
      return 0;
    }

    if (!webhooks || webhooks.length === 0) {
      return 0;
    }

    console.log(`[WebhookRetry] Processing ${webhooks.length} pending webhooks`);

    // Traiter en parallèle (avec limite de concurrence)
    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.processWebhook(webhook as WebhookPayload))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    console.log(`[WebhookRetry] Processed ${webhooks.length} webhooks, ${successCount} succeeded`);
    return successCount;
  }

  /**
   * Récupère les webhooks en dead letter pour monitoring
   */
  async getDeadLetterWebhooks(limit: number = 50): Promise<WebhookPayload[]> {
    const { data, error } = await this.supabase
      .from("webhook_queue")
      .select("*")
      .eq("status", "dead_letter")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[WebhookRetry] Error fetching dead letter webhooks:", error);
      return [];
    }

    return (data || []) as WebhookPayload[];
  }

  /**
   * Réessaie un webhook en dead letter
   */
  async retryDeadLetter(webhookId: string): Promise<boolean> {
    const { data: webhook, error: fetchError } = await this.supabase
      .from("webhook_queue")
      .select("*")
      .eq("id", webhookId)
      .eq("status", "dead_letter")
      .single();

    if (fetchError || !webhook) {
      console.error("[WebhookRetry] Dead letter webhook not found:", webhookId);
      return false;
    }

    // Réinitialiser pour un nouveau cycle de retries
    const { error: updateError } = await this.supabase
      .from("webhook_queue")
      .update({
        status: "pending",
        retry_count: 0,
        next_retry_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", webhookId);

    if (updateError) {
      console.error("[WebhookRetry] Error retrying dead letter:", updateError);
      return false;
    }

    console.log(`[WebhookRetry] Dead letter webhook reset for retry: ${webhookId}`);
    return true;
  }

  /**
   * Nettoie les webhooks anciens
   */
  async cleanupOldWebhooks(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Supprimer les webhooks réussis plus anciens que la date limite
    const { data, error } = await this.supabase
      .from("webhook_queue")
      .delete()
      .eq("status", "success")
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      console.error("[WebhookRetry] Error cleaning up old webhooks:", error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[WebhookRetry] Cleaned up ${count} old webhooks`);
    }

    return count;
  }

  /**
   * Obtient les statistiques du service
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    success: number;
    failed: number;
    deadLetter: number;
  }> {
    const { data, error } = await this.supabase
      .from("webhook_queue")
      .select("status")
      .then(({ data, error }) => {
        if (error) return { data: null, error };

        const stats = {
          pending: 0,
          processing: 0,
          success: 0,
          failed: 0,
          deadLetter: 0,
        };

        data?.forEach((row: { status: string }) => {
          switch (row.status) {
            case "pending":
              stats.pending++;
              break;
            case "processing":
              stats.processing++;
              break;
            case "success":
              stats.success++;
              break;
            case "failed":
              stats.failed++;
              break;
            case "dead_letter":
              stats.deadLetter++;
              break;
          }
        });

        return { data: stats, error: null };
      });

    if (error) {
      console.error("[WebhookRetry] Error getting stats:", error);
      return {
        pending: 0,
        processing: 0,
        success: 0,
        failed: 0,
        deadLetter: 0,
      };
    }

    return data!;
  }
}

// Singleton
export const webhookRetryService = new WebhookRetryService();

export default webhookRetryService;
