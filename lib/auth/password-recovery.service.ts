import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getServiceClient } from "@/lib/supabase/service-client";

export const PASSWORD_RESET_COOKIE_NAME = "pw_reset_access";
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type PasswordResetStatus = "pending" | "completed" | "expired" | "revoked";

export interface PasswordResetRequestRow {
  id: string;
  user_id: string;
  email_hash: string;
  status: PasswordResetStatus;
  requested_at: string;
  expires_at: string;
  used_at: string | null;
  requested_ip: string | null;
  requested_user_agent: string | null;
  completed_ip: string | null;
  metadata: Record<string, unknown>;
}

interface PasswordResetCookiePayload {
  requestId: string;
  userId: string;
  expiresAt: number;
}

interface PasswordResetRequestContext {
  requestId?: string;
  userId: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PasswordResetValidationResult {
  valid: boolean;
  request: PasswordResetRequestRow | null;
  reason?: "not_found" | "expired" | "status" | "user_mismatch" | "cookie_invalid";
}

function getPasswordResetSecret(): string {
  const secret =
    process.env.PASSWORD_RESET_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  console.warn(
    "[password-recovery] PASSWORD_RESET_COOKIE_SECRET non configuré. " +
      "Utilisation d'un secret de développement (non sécurisé en production)."
  );
  return "dev-password-reset-secret-do-not-use-in-production";
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function getRequestClientInfo(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  return {
    ipAddress,
    userAgent,
  };
}

export function createPasswordResetCookieToken(payload: PasswordResetCookiePayload): string {
  const payloadJson = JSON.stringify(payload);
  const signature = createHmac("sha256", getPasswordResetSecret())
    .update(payloadJson)
    .digest("hex");

  return Buffer.from(`${payloadJson}.${signature}`).toString("base64url");
}

export function verifyPasswordResetCookieToken(token: string | null | undefined): PasswordResetCookiePayload | null {
  if (!token) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf(".");
    if (separatorIndex === -1) return null;

    const payloadJson = decoded.slice(0, separatorIndex);
    const receivedSignature = decoded.slice(separatorIndex + 1);
    const expectedSignature = createHmac("sha256", getPasswordResetSecret())
      .update(payloadJson)
      .digest("hex");

    const receivedBuffer = Buffer.from(receivedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(payloadJson) as PasswordResetCookiePayload;
    if (!payload.requestId || !payload.userId || !payload.expiresAt) {
      return null;
    }

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getPasswordResetCookieOptions(expiresAt: string | Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/recovery/password",
    expires: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
  };
}

export function isPasswordResetRequestExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

// ---------------------------------------------------------------------------
// Token HMAC signé – remplace la dépendance DB pour la validation du lien email
// ---------------------------------------------------------------------------

interface PasswordResetTokenPayload {
  uid: string;
  exp: number;
}

/**
 * Crée un token HMAC signé contenant le userId et une expiration.
 * Le token est auto-contenu : pas besoin de lookup DB pour le valider.
 */
export function createPasswordResetToken(userId: string): string {
  const payload: PasswordResetTokenPayload = {
    uid: userId,
    exp: Date.now() + PASSWORD_RESET_TTL_MS,
  };
  const payloadJson = JSON.stringify(payload);
  const signature = createHmac("sha256", getPasswordResetSecret())
    .update(payloadJson)
    .digest("hex");

  return Buffer.from(`${payloadJson}.${signature}`).toString("base64url");
}

/**
 * Vérifie et décode un token HMAC signé.
 * Retourne { userId } si valide, null sinon.
 */
export function verifyPasswordResetToken(
  token: string | null | undefined
): { userId: string } | null {
  if (!token) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf(".");
    if (separatorIndex === -1) return null;

    const payloadJson = decoded.slice(0, separatorIndex);
    const receivedSignature = decoded.slice(separatorIndex + 1);
    const expectedSignature = createHmac("sha256", getPasswordResetSecret())
      .update(payloadJson)
      .digest("hex");

    const receivedBuffer = Buffer.from(receivedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(payloadJson) as PasswordResetTokenPayload;
    if (!payload.uid || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;

    return { userId: payload.uid };
  } catch {
    return null;
  }
}

function mapRow(row: Record<string, unknown>): PasswordResetRequestRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    email_hash: String(row.email_hash),
    status: row.status as PasswordResetStatus,
    requested_at: String(row.requested_at),
    expires_at: String(row.expires_at),
    used_at: (row.used_at as string | null) ?? null,
    requested_ip: (row.requested_ip as string | null) ?? null,
    requested_user_agent: (row.requested_user_agent as string | null) ?? null,
    completed_ip: (row.completed_ip as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function isSelectableRow(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  if ("error" in value) {
    return false;
  }

  return true;
}

async function getPasswordResetRequestById(requestId: string): Promise<PasswordResetRequestRow | null> {
  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient
    .from("password_reset_requests" as any)
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!isSelectableRow(data)) {
    return null;
  }

  return mapRow(data);
}

export async function revokePasswordResetRequest(
  requestId: string,
  status: Extract<PasswordResetStatus, "revoked" | "expired"> = "revoked"
): Promise<void> {
  const serviceClient = getServiceClient();
  await serviceClient
    .from("password_reset_requests" as any)
    .update({
      status,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", requestId)
    .eq("status", "pending");
}

async function revokeActiveRequestsForUser(userId: string): Promise<void> {
  const serviceClient = getServiceClient();

  await serviceClient
    .from("password_reset_requests" as any)
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    } as any)
    .eq("user_id", userId)
    .eq("status", "pending");
}

export async function createPasswordResetRequest(
  context: PasswordResetRequestContext
): Promise<PasswordResetRequestRow> {
  const requestId = context.requestId || randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const serviceClient = getServiceClient();

  await revokeActiveRequestsForUser(context.userId);

  const { data, error } = await serviceClient
    .from("password_reset_requests" as any)
    .insert({
      id: requestId,
      user_id: context.userId,
      email_hash: hashEmail(context.email),
      status: "pending",
      requested_at: new Date().toISOString(),
      expires_at: expiresAt,
      requested_ip: context.ipAddress || null,
      requested_user_agent: context.userAgent || null,
      metadata: context.metadata || {},
    } as any)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Impossible de créer la demande de réinitialisation.");
  }

  if (!isSelectableRow(data)) {
    throw new Error("La demande créée n'a pas retourné une ligne exploitable.");
  }

  return mapRow(data);
}

/**
 * Récupère et valide une demande de reset par requestId uniquement (sans userId).
 * Utilisé dans le callback quand aucune session Supabase n'est disponible.
 */
export async function getValidPendingRequest(
  requestId: string
): Promise<PasswordResetRequestRow | null> {
  const request = await getPasswordResetRequestById(requestId);

  if (!request) return null;

  if (isPasswordResetRequestExpired(request.expires_at)) {
    await revokePasswordResetRequest(request.id, "expired");
    return null;
  }

  if (request.status !== "pending") return null;

  return request;
}

export async function validatePasswordResetRequestForCallback(params: {
  requestId: string;
  userId: string;
}): Promise<PasswordResetValidationResult> {
  const request = await getPasswordResetRequestById(params.requestId);

  if (!request) {
    return { valid: false, request: null, reason: "not_found" };
  }

  if (isPasswordResetRequestExpired(request.expires_at)) {
    await revokePasswordResetRequest(request.id, "expired");
    return { valid: false, request, reason: "expired" };
  }

  if (request.status !== "pending") {
    return { valid: false, request, reason: "status" };
  }

  if (request.user_id !== params.userId) {
    return { valid: false, request, reason: "user_mismatch" };
  }

  return { valid: true, request };
}

export async function validatePasswordResetAccess(params: {
  requestId: string;
  userId: string;
  cookieToken?: string | null;
}): Promise<PasswordResetValidationResult> {
  const requestValidation = await validatePasswordResetRequestForCallback({
    requestId: params.requestId,
    userId: params.userId,
  });

  if (!requestValidation.valid || !requestValidation.request) {
    return requestValidation;
  }

  const cookiePayload = verifyPasswordResetCookieToken(params.cookieToken);
  if (!cookiePayload) {
    return { valid: false, request: requestValidation.request, reason: "cookie_invalid" };
  }

  if (
    cookiePayload.requestId !== params.requestId ||
    cookiePayload.userId !== params.userId ||
    cookiePayload.expiresAt !== new Date(requestValidation.request.expires_at).getTime()
  ) {
    return { valid: false, request: requestValidation.request, reason: "cookie_invalid" };
  }

  return requestValidation;
}

export async function markPasswordResetCompleted(params: {
  requestId: string;
  completedIp?: string | null;
}): Promise<void> {
  const serviceClient = getServiceClient();
  await serviceClient
    .from("password_reset_requests" as any)
    .update({
      status: "completed",
      used_at: new Date().toISOString(),
      completed_ip: params.completedIp || null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", params.requestId)
    .eq("status", "pending");
}
