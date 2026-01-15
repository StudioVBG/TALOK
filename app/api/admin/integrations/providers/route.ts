export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptKey } from "@/lib/helpers/encryption";

/**
 * GET /api/admin/integrations/providers
 * Liste tous les providers avec leur statut de configuration
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer tous les providers avec leurs credentials
    // Note: On sélectionne uniquement les colonnes qui existent dans la table
    const { data: providers, error: providersError } = await supabase
      .from("api_providers")
      .select(`
        *,
        credentials:api_credentials(
          id,
          env,
          scope,
          secret_ref,
          expires_at,
          created_at
        )
      `)
      .order("category", { ascending: true });

    if (providersError) {
      console.error("Erreur providers:", providersError);
      throw providersError;
    }

    // Enrichir avec le statut de configuration
    const enrichedProviders = (providers || []).map((provider: any) => {
      // Vérifier si des credentials existent pour ce provider
      const prodCredential = provider.credentials?.find((c: any) => c.env === "prod");
      const devCredential = provider.credentials?.find((c: any) => c.env === "dev");
      const hasCredentials = provider.credentials && provider.credentials.length > 0;
      
      return {
        ...provider,
        is_configured: hasCredentials,
        active_env: prodCredential ? "prod" : devCredential ? "dev" : null,
        credentials: provider.credentials?.map((c: any) => ({
          id: c.id,
          env: c.env,
          scope: c.scope,
          created_at: c.created_at,
          has_key: !!c.secret_ref,
        })) || [],
      };
    });

    // Grouper par catégorie
    const byCategory: Record<string, any[]> = {};
    enrichedProviders.forEach((p: any) => {
      if (!byCategory[p.category]) {
        byCategory[p.category] = [];
      }
      byCategory[p.category].push(p);
    });

    return NextResponse.json({
      providers: enrichedProviders,
      byCategory,
      categories: Object.keys(byCategory).sort(),
    });
  } catch (error: any) {
    console.error("Erreur GET providers:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/integrations/providers
 * Configurer une clé API pour un provider
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { provider_id, api_key, config, env = "prod" } = body;

    if (!provider_id || !api_key) {
      return NextResponse.json(
        { error: "provider_id et api_key sont requis" },
        { status: 400 }
      );
    }

    // Vérifier que le provider existe
    const { data: provider, error: providerError } = await supabase
      .from("api_providers")
      .select("*")
      .eq("id", provider_id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider non trouvé" },
        { status: 404 }
      );
    }

    // Chiffrer la clé API
    const encryptedKey = encryptKey(api_key);

    // Supprimer les anciennes credentials pour ce provider/env (car pas de colonne is_active)
    await supabase
      .from("api_credentials")
      .delete()
      .eq("provider_id", provider_id)
      .eq("env", env);

    // Créer la nouvelle credential avec les colonnes qui existent
    // Structure de base: provider_id, env, scope, secret_ref, expires_at, owner_user_id
    const { data: credential, error: credentialError } = await supabase
      .from("api_credentials")
      .insert({
        provider_id,
        env,
        scope: config ? JSON.stringify(config) : null, // Stocker la config dans scope
        secret_ref: encryptedKey, // Stocker la clé chiffrée dans secret_ref
        owner_user_id: user.id,
      })
      .select()
      .single();

    if (credentialError) {
      console.error("Erreur création credential:", credentialError);
      throw credentialError;
    }

    // Logger l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_configured",
      entity_type: "api_credential",
      entity_id: credential.id,
      metadata: { provider_name: provider.name, env },
    });

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        env: credential.env,
        key_preview: `${api_key.substring(0, 6)}...${api_key.substring(api_key.length - 4)}`,
      },
      message: `${provider.name} configuré avec succès`,
    });
  } catch (error: any) {
    console.error("Erreur POST provider:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
