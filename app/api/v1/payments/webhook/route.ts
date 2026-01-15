export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, logAudit } from "@/lib/api/middleware";
import crypto from "crypto";

/**
 * POST /api/v1/payments/webhook
 * Handle payment provider webhooks (Stripe/GoCardless)
 * Events: Payment.Succeeded, Payment.Failed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const signature = request.headers.get("stripe-signature") || request.headers.get("x-signature");
    const rawBody = await request.text();

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return apiError("Invalid webhook signature", 401, "INVALID_SIGNATURE");
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const eventType = body.type || body.event_type;
    const providerIntentId = body.data?.object?.id || body.payment_intent_id;

    if (!providerIntentId) {
      return apiError("Missing payment intent ID", 400);
    }

    // Find payment by provider reference
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, invoices(*)")
      .eq("provider_ref", providerIntentId)
      .single();

    if (paymentError || !payment) {
      console.error("[webhook] Payment not found:", providerIntentId);
      // Return 200 to avoid retries for unknown payments
      return apiSuccess({ received: true, status: "ignored" });
    }

    // Re-read resource before state transition (write-behind safety)
    const { data: currentPayment } = await supabase
      .from("payments")
      .select("statut")
      .eq("id", payment.id)
      .single();

    // Process based on event type
    switch (eventType) {
      case "payment_intent.succeeded":
      case "payment.succeeded": {
        if (currentPayment?.statut === "succeeded") {
          // Already processed
          return apiSuccess({ received: true, status: "already_processed" });
        }

        // Update payment
        await supabase
          .from("payments")
          .update({
            statut: "succeeded",
            date_paiement: new Date().toISOString().split("T")[0],
          })
          .eq("id", payment.id);

        // Check if invoice is fully paid
        const { data: allPayments } = await supabase
          .from("payments")
          .select("montant")
          .eq("invoice_id", payment.invoice_id)
          .eq("statut", "succeeded");

        const totalPaid = (allPayments || []).reduce(
          (sum, p) => sum + Number(p.montant || 0),
          0
        );

        if (totalPaid >= Number(payment.invoices?.montant_total || 0)) {
          // Mark invoice as paid
          await supabase
            .from("invoices")
            .update({ statut: "paid" })
            .eq("id", payment.invoice_id);

          // Emit Receipt.Issued event
          await supabase.from("outbox").insert({
            event_type: "Receipt.Issued",
            payload: {
              invoice_id: payment.invoice_id,
              payment_id: payment.id,
            },
          });
        }

        // Emit event
        await supabase.from("outbox").insert({
          event_type: "Payment.Succeeded",
          payload: {
            payment_id: payment.id,
            invoice_id: payment.invoice_id,
            amount: payment.montant,
          },
        });

        // Audit log
        await logAudit(
          supabase,
          "payment.succeeded",
          "payments",
          payment.id,
          "system",
          { statut: "pending" },
          { statut: "succeeded" }
        );

        break;
      }

      case "payment_intent.payment_failed":
      case "payment.failed": {
        if (currentPayment?.statut === "failed") {
          return apiSuccess({ received: true, status: "already_processed" });
        }

        await supabase
          .from("payments")
          .update({ statut: "failed" })
          .eq("id", payment.id);

        // Emit event
        await supabase.from("outbox").insert({
          event_type: "Payment.Failed",
          payload: {
            payment_id: payment.id,
            invoice_id: payment.invoice_id,
            reason: body.data?.object?.last_payment_error?.message || "Unknown error",
          },
        });

        // Audit log
        await logAudit(
          supabase,
          "payment.failed",
          "payments",
          payment.id,
          "system",
          { statut: "pending" },
          { statut: "failed" }
        );

        break;
      }

      default:
        console.log("[webhook] Unhandled event type:", eventType);
    }

    return apiSuccess({ received: true });
  } catch (error: any) {
    console.error("[webhook] Error:", error);
    return apiError("Webhook processing error", 500);
  }
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Stripe signature verification
    if (signature.startsWith("t=")) {
      const parts = signature.split(",");
      const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
      const v1Sig = parts.find((p) => p.startsWith("v1="))?.slice(3);

      if (!timestamp || !v1Sig) return false;

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(v1Sig),
        Buffer.from(expectedSig)
      );
    }

    // Generic HMAC verification
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

