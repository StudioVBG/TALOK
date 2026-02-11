/**
 * Edge Function: Nettoyage automatique des données orphelines
 *
 * Planification recommandée : tous les jours à 3h du matin
 * cron: 0 3 * * *
 *
 * Utilise la RPC `cleanup_orphan_documents()` qui :
 * - Supprime les documents dont le bail/propriété n'existe plus
 * - Purge les notifications lues > 90 jours
 * - Purge les OTP expirés > 24h
 * - Purge le cache de preview expiré
 *
 * Puis supprime les fichiers Storage correspondants.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STORAGE_BUCKET_DOCUMENTS = "documents"

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Appeler la RPC transactionnelle
    const { data, error } = await supabase.rpc("cleanup_orphan_documents")

    if (error) {
      console.error("cleanup_orphan_documents RPC error:", error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const result = data as {
      orphan_documents_lease: number
      orphan_documents_property: number
      old_notifications: number
      expired_otp: number
      expired_previews: number
      storage_paths_to_delete: string[] | null
      executed_at: string
    }

    // Supprimer les fichiers Storage orphelins
    let storageDeleted = 0
    const paths = result.storage_paths_to_delete
    if (paths && paths.length > 0) {
      // Supabase Storage accepte max 1000 fichiers par appel
      const BATCH_SIZE = 100
      for (let i = 0; i < paths.length; i += BATCH_SIZE) {
        const batch = paths.slice(i, i + BATCH_SIZE).filter(Boolean)
        if (batch.length > 0) {
          const { error: storageError } = await supabase.storage
            .from(STORAGE_BUCKET_DOCUMENTS)
            .remove(batch)

          if (storageError) {
            console.error(`Storage batch delete error (batch ${i}):`, storageError)
          } else {
            storageDeleted += batch.length
          }
        }
      }
    }

    const summary = {
      ...result,
      storage_files_deleted: storageDeleted,
      storage_paths_to_delete: undefined, // Ne pas renvoyer les paths dans la réponse
    }

    console.log("Cleanup completed:", JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Cleanup edge function error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
