/**
 * Outbound Webhook Dispatch System
 *
 * Sends HMAC-SHA256 signed payloads to configured webhook URLs.
 * Retries on failure with exponential backoff.
 *
 * Header: X-Talok-Signature: sha256=xxxxx
 * Header: X-Talok-Event: event.type
 * Header: X-Talok-Delivery: delivery-uuid
 */

import { createClient } from "@/lib/supabase/server";

// --------------------------------------------------------------------------
// Available webhook events
// --------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "property.created",
  "property.updated",
  "property.deleted",
  "lease.created",
  "lease.signed",
  "lease.terminated",
  "payment.received",
  "payment.failed",
  "document.created",
  "document.signed",
  "tenant.invited",
  "tenant.moved_in",
  "tenant.moved_out",
  "invoice.created",
  "invoice.paid",
  "invoice.overdue",
  "ticket.created",
  "ticket.resolved",
  "accounting.entry_created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// --------------------------------------------------------------------------
// HMAC signing
// --------------------------------------------------------------------------

/**
 * Sign a webhook payload with HMAC-SHA256
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --------------------------------------------------------------------------
// Dispatch
// --------------------------------------------------------------------------

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  delivery_id: string;
}

/**
 * Dispatch a webhook event to all matching active webhooks for a profile.
 *
 * This is fire-and-forget — call it after the main operation succeeds.
 */
export async function dispatchWebhookEvent(
  profileId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();

    // Find all active webhooks for this profile that subscribe to this event
    const { data: webhooks, error } = await supabase
      .from("api_webhooks")
      .select("id, url, events, secret")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (error || !webhooks || webhooks.length === 0) return;

    const deliveryId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const payload: WebhookPayload = {
      event,
      data,
      timestamp,
      delivery_id: deliveryId,
    };

    const payloadString = JSON.stringify(payload);

    // Send to all matching webhooks concurrently
    await Promise.allSettled(
      webhooks.map((webhook: any) =>
        deliverWebhook(supabase, webhook, event, payloadString, deliveryId)
      )
    );
  } catch (err) {
    console.error("[webhooks] Failed to dispatch event:", event, err);
  }
}

/**
 * Deliver a single webhook with retry logic
 */
async function deliverWebhook(
  supabase: any,
  webhook: { id: string; url: string; secret: string },
  event: string,
  payloadString: string,
  deliveryId: string,
  attempt: number = 1
): Promise<void> {
  const maxRetries = 3;
  const startTime = Date.now();

  try {
    const signature = await signPayload(payloadString, webhook.secret);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Talok-Signature": `sha256=${signature}`,
        "X-Talok-Event": event,
        "X-Talok-Delivery": deliveryId,
        "User-Agent": "Talok-Webhooks/1.0",
      },
      body: payloadString,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    const responseTimeMs = Date.now() - startTime;
    let responseBody: string | null = null;
    try {
      responseBody = await response.text();
    } catch {
      // ignore
    }

    // Log delivery
    await supabase.from("api_webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: event,
      payload: JSON.parse(payloadString),
      status_code: response.status,
      response_body: responseBody?.slice(0, 1000) || null,
      response_time_ms: responseTimeMs,
      attempt,
    });

    // Update webhook metadata
    if (response.ok) {
      await supabase
        .from("api_webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status_code: response.status,
          failure_count: 0,
        })
        .eq("id", webhook.id);
    } else {
      // Non-2xx — increment failure count
      await supabase.rpc("increment_webhook_failure", {
        webhook_id: webhook.id,
        status: response.status,
      }).catch(() => {
        // Fallback: simple update
        supabase
          .from("api_webhooks")
          .update({
            last_triggered_at: new Date().toISOString(),
            last_status_code: response.status,
            failure_count: supabase.raw("failure_count + 1"),
          })
          .eq("id", webhook.id);
      });

      // Retry on 5xx
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, delay));
        return deliverWebhook(
          supabase,
          webhook,
          event,
          payloadString,
          deliveryId,
          attempt + 1
        );
      }
    }
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    // Log failed delivery
    await supabase
      .from("api_webhook_deliveries")
      .insert({
        webhook_id: webhook.id,
        event_type: event,
        payload: JSON.parse(payloadString),
        status_code: 0,
        error: errorMessage,
        response_time_ms: responseTimeMs,
        attempt,
      })
      .catch(() => {});

    // Retry on network errors
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return deliverWebhook(
        supabase,
        webhook,
        event,
        payloadString,
        deliveryId,
        attempt + 1
      );
    }

    // Disable webhook after too many failures
    await supabase
      .from("api_webhooks")
      .update({ failure_count: 999 }) // Will trigger auto-disable check
      .eq("id", webhook.id)
      .catch(() => {});
  }
}

/**
 * Send a test webhook to verify the endpoint works.
 */
export async function sendTestWebhook(
  webhookId: string,
  profileId: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const supabase = await createClient();

  const { data: webhook, error } = await supabase
    .from("api_webhooks")
    .select("id, url, secret, events")
    .eq("id", webhookId)
    .eq("profile_id", profileId)
    .single();

  if (error || !webhook) {
    return { success: false, error: "Webhook not found" };
  }

  const deliveryId = crypto.randomUUID();
  const payload: WebhookPayload = {
    event: "test",
    data: {
      message: "This is a test webhook from Talok",
      webhook_id: webhook.id,
      subscribed_events: webhook.events,
    },
    timestamp: new Date().toISOString(),
    delivery_id: deliveryId,
  };

  const payloadString = JSON.stringify(payload);
  const signature = await signPayload(payloadString, webhook.secret);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Talok-Signature": `sha256=${signature}`,
        "X-Talok-Event": "test",
        "X-Talok-Delivery": deliveryId,
        "User-Agent": "Talok-Webhooks/1.0",
      },
      body: payloadString,
      signal: AbortSignal.timeout(10_000),
    });

    // Log delivery
    await supabase.from("api_webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: "test",
      payload,
      status_code: response.status,
      response_time_ms: 0,
      attempt: 1,
    });

    return { success: response.ok, statusCode: response.status };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Connection failed";
    return { success: false, error: errorMessage };
  }
}
