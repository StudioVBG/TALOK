export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route: Rotation d'une clé API
 * POST /api/admin/api-keys/[id]/rotate
 * 
 * Génère une nouvelle clé et invalide l'ancienne.
 * Le cache est automatiquement vidé.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { apiKeysService } from "@/lib/services/api-keys.service";

// Fonction pour chiffrer une clé API avec AES-256-GCM
function encryptAPIKey(apiKey: string, masterKey: string): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que c'est un admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((profile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut rotater les clés" },
        { status: 403 }
      );
    }

    const keyId = params.id;

    // Récupérer la clé existante avec le provider
    const { data: existingKey, error: fetchError } = await supabase
      .from("api_credentials")
      .select(`
        *,
        provider:api_providers(name)
      `)
      .eq("id", keyId)
      .single();

    if (fetchError || !existingKey) {
      return NextResponse.json(
        { error: "Clé non trouvée" },
        { status: 404 }
      );
    }

    // Générer une nouvelle clé
    const newApiKey = `sk_${crypto.randomBytes(32).toString("hex")}`;
    const newHashedKey = crypto.createHash("sha256").update(newApiKey).digest("hex");

    // Chiffrer la nouvelle clé
    const masterKey = process.env.API_KEY_MASTER_KEY || 
      process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 32) || 
      "default-master-key-32-chars!!";
    const newEncryptedKey = encryptAPIKey(newApiKey, masterKey);

    // Mettre à jour la clé
    const { data: updatedKey, error: updateError } = await supabase
      .from("api_credentials")
      .update({
        key_hash: newHashedKey,
        encrypted_key: newEncryptedKey,
        rotated_at: new Date().toISOString(),
      })
      .eq("id", keyId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Vider le cache pour ce provider
    const providerName = (existingKey as any).provider?.name;
    if (providerName) {
      apiKeysService.clearCache(providerName);
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "API.KeyRotated",
      payload: {
        credential_id: keyId,
        provider: providerName,
      },
    });

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_rotated",
      entity_type: "api_credential",
      entity_id: keyId,
      metadata: { provider: providerName },
    });

    return NextResponse.json({
      success: true,
      credential: {
        ...updatedKey,
        encrypted_key: undefined, // Ne pas retourner la clé chiffrée
        key_hash: (updatedKey as any).key_hash?.substring(0, 8) + "...",
      },
      api_key: newApiKey, // Afficher une seule fois
      warning: "Cette clé ne sera plus affichée. Veuillez la sauvegarder.",
    });
  } catch (error: any) {
    console.error("Erreur rotation clé:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
