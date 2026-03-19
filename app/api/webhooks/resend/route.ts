export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    tags?: Record<string, string>;
    [key: string]: unknown;
  };
}

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signaturePart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.replace("t=", "");
  const expectedSig = signaturePart.replace("v1=", "");

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const signedContent = `${timestamp}.${payload}`;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(expectedSig)
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (RESEND_WEBHOOK_SECRET) {
      const svixSignature = request.headers.get("svix-signature");
      const isValid = verifyWebhookSignature(
        rawBody,
        svixSignature,
        RESEND_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.warn("[Resend Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event: ResendWebhookPayload = JSON.parse(rawBody);

    console.log(
      `[Resend Webhook] ${event.type} | email_id: ${event.data.email_id} | to: ${event.data.to?.join(", ")}`
    );

    switch (event.type) {
      case "email.delivered":
        break;

      case "email.bounced":
        console.error(
          `[Resend Webhook] BOUNCE: ${event.data.to?.join(", ")} | subject: ${event.data.subject}`
        );
        break;

      case "email.complained":
        console.error(
          `[Resend Webhook] COMPLAINT: ${event.data.to?.join(", ")} | subject: ${event.data.subject}`
        );
        break;

      case "email.delivery_delayed":
        console.warn(
          `[Resend Webhook] DELAYED: ${event.data.to?.join(", ")} | subject: ${event.data.subject}`
        );
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (error: unknown) {
    console.error("[Resend Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
