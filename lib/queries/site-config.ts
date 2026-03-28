import { createClient } from "@/lib/supabase/server";
import { LANDING_IMAGE_DEFAULTS } from "@/lib/config/landing-image-defaults";

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
 * Merge avec les defaults pour garantir un affichage même
 * si la table n'existe pas encore.
 */
export async function getSiteConfig(
  keys: SiteConfigKey[]
): Promise<Record<SiteConfigKey, string>> {
  // Start with defaults for requested keys
  const result = {} as Record<SiteConfigKey, string>;
  for (const k of keys) {
    result[k] = LANDING_IMAGE_DEFAULTS[k] ?? "";
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_config")
      .select("key, value")
      .in("key", keys);

    for (const row of data ?? []) {
      if (row.value) {
        result[row.key as SiteConfigKey] = row.value;
      }
    }
  } catch {
    // Table doesn't exist yet — defaults already in result
  }

  return result;
}

/**
 * Récupère toutes les entrées site_config sous forme de map clé → valeur.
 */
export async function getSiteConfigMap(): Promise<Record<string, string>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_config")
      .select("key, value");

    if (!data) return { ...LANDING_IMAGE_DEFAULTS };

    const dbValues = Object.fromEntries(
      data.filter((r) => r.value).map((r) => [r.key, r.value as string])
    );
    return { ...LANDING_IMAGE_DEFAULTS, ...dbValues };
  } catch {
    return { ...LANDING_IMAGE_DEFAULTS };
  }
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
