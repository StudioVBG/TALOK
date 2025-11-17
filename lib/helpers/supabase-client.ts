/**
 * Helper pour obtenir un client Supabase typé
 * Évite les problèmes de typage TypeScript avec les unions complexes
 */
export function getTypedSupabaseClient(supabase: any) {
  return supabase as any;
}

