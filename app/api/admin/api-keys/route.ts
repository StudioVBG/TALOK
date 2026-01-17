export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Fonction pour chiffrer une clé API avec AES-256-GCM
function encryptAPIKey(apiKey: string, masterKey: string): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Retourner IV + authTag + encrypted (tout en hex)
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

// Fonction pour déchiffrer une clé API
function decryptAPIKey(encryptedKey: string, masterKey: string): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "salt", 32);
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * POST /api/admin/api-keys - Créer une clé API
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut créer des clés API" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { provider_id, name, permissions } = body;

    if (!provider_id || !name) {
      return NextResponse.json(
        { error: "provider_id et name requis" },
        { status: 400 }
      );
    }

    // Générer une clé API
    const apiKey = `sk_${crypto.randomBytes(32).toString("hex")}`;
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Chiffrer la clé avec une clé maître (AES-256-GCM)
    const masterKey = process.env.API_KEY_MASTER_KEY;
    if (!masterKey) {
      throw new Error("API_KEY_MASTER_KEY n'est pas défini côté serveur");
    }
    if (masterKey.length < 32) {
      throw new Error("API_KEY_MASTER_KEY doit contenir au moins 32 caractères");
    }
    const encryptedKey = encryptAPIKey(apiKey, masterKey);

    // Créer la clé API
    const { data: apiCredential, error } = await supabase
      .from("api_credentials")
      .insert({
        provider_id,
        name,
        key_hash: hashedKey,
        encrypted_key: encryptedKey, // Clé chiffrée
        permissions: permissions || {},
        is_active: true,
        created_by: user.id,
        env: "prod", // Valeur par défaut
        secret_ref: "encrypted", // Indique que la clé est chiffrée
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "API.KeyCreated",
      payload: {
        credential_id: (apiCredential as any)?.id,
        provider_id,
        name,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_created",
      entity_type: "api_credential",
      entity_id: (apiCredential as any).id,
      metadata: { provider_id, name },
    } as any);

    // Retourner la clé (une seule fois)
    return NextResponse.json({
      credential: apiCredential,
      api_key: apiKey, // À afficher une seule fois
      warning: "Cette clé ne sera plus affichée. Veuillez la sauvegarder.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/api-keys - Lister les clés API
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut voir les clés API" },
        { status: 403 }
      );
    }

    const { data: credentials, error } = await supabase
      .from("api_credentials")
      .select(`
        *,
        provider:api_providers(name, type)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Ne pas retourner les clés chiffrées
    const sanitized = (credentials || []).map((c: any) => ({
      ...c,
      encrypted_key: undefined,
      key_hash: c.key_hash?.substring(0, 8) + "...",
    }));

    return NextResponse.json({ 
      credentials: sanitized,
      keys: sanitized // Alias pour compatibilité
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

