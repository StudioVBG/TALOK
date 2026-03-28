/**
 * URLs par défaut des images landing — utilisées comme fallback
 * si site_config n'est pas encore renseigné (ou table absente).
 * L'admin peut les remplacer via /admin/landing-images.
 */
export const LANDING_IMAGE_DEFAULTS: Record<string, string> = {
  // Arguments
  landing_arg_time_img:
    "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80",
  landing_arg_money_img:
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  landing_arg_contract_img:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80",
  landing_arg_sleep_img:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80",
  // Profils
  landing_profile_owner_img:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80",
  landing_profile_investor_img:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
  landing_profile_agency_img:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80",
  // Avant / Après
  landing_beforeafter_img:
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
};
