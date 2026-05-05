/**
 * POST /api/qr/generate
 *
 * Endpoint générique de génération de QR codes brandés Talok.
 * Utilisé par n'importe quel module qui a besoin d'un QR avec logo Talok au centre.
 *
 * Body : { data: string, withLogo?: boolean, size?: number, errorCorrection?: 'L'|'M'|'Q'|'H' }
 * Réponse : { dataUrl: string }
 *
 * @security Authentification requise (évite de fournir un service public gratuit
 *   de génération de QR à des bots).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { generateBrandedQR } from "@/lib/qr/generator";

const MAX_DATA_LENGTH = 2048;

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "api");
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { data, withLogo = true, size = 320, errorCorrection } = body || {};

  if (typeof data !== "string" || data.length === 0) {
    return NextResponse.json({ error: "Champ 'data' manquant" }, { status: 400 });
  }
  if (data.length > MAX_DATA_LENGTH) {
    return NextResponse.json(
      { error: `Données trop longues (max ${MAX_DATA_LENGTH} caractères)` },
      { status: 400 }
    );
  }
  if (typeof size !== "number" || size < 128 || size > 1024) {
    return NextResponse.json(
      { error: "size doit être un nombre entre 128 et 1024" },
      { status: 400 }
    );
  }

  try {
    const dataUrl = await generateBrandedQR(data, {
      size,
      withLogo: !!withLogo,
      errorCorrection,
    });
    return NextResponse.json({ dataUrl });
  } catch (error) {
    console.error("[qr/generate] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du QR code" },
      { status: 500 }
    );
  }
}
