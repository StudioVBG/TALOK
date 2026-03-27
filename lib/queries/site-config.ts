import { createClient } from "@/lib/supabase/server";

/**
 * Récupère toutes les entrées site_config sous forme de map clé → valeur.
 */
export async function getSiteConfigMap(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_config")
    .select("key, value");

  if (!data) return {};
  return Object.fromEntries(
    data.filter((r) => r.value).map((r) => [r.key, r.value as string])
  );
}

/**
 * Récupère les entrées site_config filtrées par section.
 */
export async function getSiteConfigBySection(section: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_config")
    .select("key, value, label, section, updated_at")
    .eq("section", section);

  return data ?? [];
}

/**
 * Récupère toutes les entrées site_config avec métadonnées (pour l'admin).
 */
export async function getAllSiteConfigs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_config")
    .select("key, value, label, section, updated_at")
    .order("section")
    .order("key");

  return data ?? [];
}
