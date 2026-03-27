import { createClient } from "@/lib/supabase/server";

export type SiteConfigKey =
  | "landing_arg_time_img"
  | "landing_arg_money_img"
  | "landing_arg_contract_img"
  | "landing_arg_sleep_img"
  | "landing_profile_owner_img"
  | "landing_profile_investor_img"
  | "landing_profile_agency_img"
  | "landing_beforeafter_img";

/**
 * Récupère un sous-ensemble typé de clés site_config.
 */
export async function getSiteConfig(
  keys: SiteConfigKey[]
): Promise<Record<SiteConfigKey, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_config")
    .select("key, value")
    .in("key", keys);

  const result = {} as Record<SiteConfigKey, string>;
  for (const row of data ?? []) {
    result[row.key as SiteConfigKey] = row.value;
  }
  return result;
}

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
