export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { encryptKey } from "@/lib/helpers/encryption";
import { invalidateCredentialsCache, type ProviderName } from "@/lib/services/credentials-service";

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
        credentials: provider.credentials?.map((c: any) => {
          let config: Record<string, string> = {};
          if (typeof c.scope === "string" && c.scope) {
            try {
              config = JSON.parse(c.scope) as Record<string, string>;
            } catch {
              // scope non-JSON, laisser config vide
            }
          }
          return {
            id: c.id,
            env: c.env,
            scope: c.scope,
            config,
            is_active: true,
            created_at: c.created_at,
            has_key: !!c.secret_ref,
          };
        }) || [],
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
  } catch (error: unknown) {
    console.error("Erreur GET providers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
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

    if (!provider_id) {
      return NextResponse.json(
        { error: "provider_id est requis" },
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

    const providerName = provider.name as ProviderName;
    const scopeValue = config && Object.keys(config).length > 0 ? JSON.stringify(config) : null;

    if (api_key) {
      // Cas 1 : api_key fourni — remplacement complet
      const encryptedKey = encryptKey(api_key);

      await supabase
        .from("api_credentials")
        .delete()
        .eq("provider_id", provider_id)
        .eq("env", env);

      const { data: credential, error: credentialError } = await supabase
        .from("api_credentials")
        .insert({
          provider_id,
          env,
          scope: scopeValue,
          secret_ref: encryptedKey,
          owner_user_id: user.id,
        })
        .select()
        .single();

      if (credentialError) {
        console.error("Erreur création credential:", credentialError);
        throw credentialError;
      }

      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "provider_configured",
        entity_type: "api_credential",
        entity_id: credential.id,
        metadata: { provider_name: provider.name, env },
      });

      invalidateCredentialsCache(providerName);

      return NextResponse.json({
        success: true,
        credential: {
          id: credential.id,
          env: credential.env,
          key_preview: `${api_key.substring(0, 6)}...${api_key.substring(api_key.length - 4)}`,
        },
        message: `${provider.name} configuré avec succès`,
      });
    }

    // Cas 2 : api_key absent — mise à jour de la config (scope) uniquement
    const { data: existingCredential, error: fetchError } = await supabase
      .from("api_credentials")
      .select("id")
      .eq("provider_id", provider_id)
      .eq("env", env)
      .maybeSingle();

    if (fetchError || !existingCredential) {
      return NextResponse.json(
        {
          error:
            "Fournissez la clé API pour une première configuration, ou modifiez un environnement déjà configuré.",
        },
        { status: 400 }
      );
    }

    if (!existingCredential.id) {
      return NextResponse.json(
        { error: "Missing credential id" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("api_credentials")
      .update({ scope: scopeValue })
      .eq("id", existingCredential.id);

    if (updateError) {
      console.error("Erreur mise à jour credential:", updateError);
      throw updateError;
    }

    invalidateCredentialsCache(providerName);

    return NextResponse.json({
      success: true,
      credential: { id: existingCredential.id, env },
      message: `${provider.name} mis à jour (config uniquement)`,
    });
  } catch (error: unknown) {
    console.error("Erreur POST provider:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
