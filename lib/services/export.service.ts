/**
 * Service d'export de donnees - Server-side (CANONICAL)
 *
 * Service centralise et securise pour la gestion des exports de donnees.
 * C'est le service recommande pour tous les nouveaux developpements.
 *
 * Fonctionnalites de securite :
 * - Protection contre les injections CSV (caracteres speciaux prefixes)
 * - URLs signees avec TTL de 15 minutes
 * - Journalisation d'audit complete
 * - Gestion des jobs d'export avec statuts (pending, processing, completed, failed)
 * - Stockage securise via Supabase Storage
 *
 * Formats supportes : CSV, JSON
 *
 * @module ServerExportService
 * @see Pour les exports rapides cote client, voir `@/lib/services/export-service`
 */
import { createClient } from "@/lib/supabase/server";

export interface ExportOptions {
  userId: string;
  type: string;
  format: 'csv' | 'json';
  data: any[];
  columns: string[];
}

/**
 * Service centralise pour la gestion des exports de donnees.
 * Respecte les standards de securite (CSV Injection, Signed URLs) et de conformite (Audit).
 *
 * @example
 * ```typescript
 * // Demarrer un export
 * const jobId = await ExportService.startExport({
 *   userId: user.id,
 *   type: 'accounting',
 *   format: 'csv',
 *   data: invoices,
 *   columns: ['date', 'montant', 'statut']
 * });
 *
 * // Recuperer l'URL de telechargement
 * const url = await ExportService.getSignedUrl(jobId, user.id);
 * ```
 */
export class ExportService {
  /**
   * Protège contre la CSV Injection en préfixant les caractères spéciaux par une apostrophe.
   */
  private static sanitizeCSVCell(value: any): string {
    const str = String(value ?? "");
    if (str.length > 0 && ['=', '+', '-', '@'].includes(str[0])) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Génère le contenu CSV sécurisé.
   */
  static generateCSV(data: any[], columns: string[]): string {
    const header = columns.join(",");
    const rows = data.map(item => 
      columns.map(col => {
        const val = item[col];
        const sanitized = this.sanitizeCSVCell(val);
        // Échappe les guillemets et entoure la valeur de guillemets
        return `"${sanitized.replace(/"/g, '""')}"`;
      }).join(",")
    );
    return [header, ...rows].join("\n");
  }

  /**
   * Crée un job d'export, génère le fichier et l'upload vers le stockage sécurisé.
   */
  static async startExport(options: ExportOptions): Promise<string> {
    const supabase = await createClient();
    
    // 1. Créer le record du job (statut pending)
    const { data: job, error: jobError } = await supabase
      .from("export_jobs")
      .insert({
        user_id: options.userId,
        type: options.type,
        format: options.format,
        status: 'processing'
      })
      .select()
      .single();

    if (jobError) throw new Error(`Erreur lors de la création du job: ${jobError.message}`);

    try {
      let content: string;
      let contentType: string;
      
      if (options.format === 'csv') {
        content = this.generateCSV(options.data, options.columns);
        contentType = 'text/csv';
      } else {
        content = JSON.stringify(options.data, null, 2);
        contentType = 'application/json';
      }

      const fileName = `${options.type}_${job.id}.${options.format}`;
      const storagePath = `exports/${options.userId}/${fileName}`;

      // 2. Upload vers Storage (Bucket 'documents' qui devrait être privé)
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, content, {
          contentType,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);

      // 3. Mise à jour du job (statut completed)
      const { error: updateError } = await supabase
        .from("export_jobs")
        .update({
          status: 'completed',
          storage_path: storagePath,
          record_count: options.data.length,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      if (updateError) throw updateError;

      // 4. Audit Log
      await supabase.from("audit_log").insert({
        user_id: options.userId,
        action: "export",
        entity_type: "data_export",
        entity_id: job.id,
        metadata: { 
          type: options.type, 
          format: options.format, 
          record_count: options.data.length 
        }
      });

      return job.id;
    } catch (error: any) {
      // En cas d'échec, on marque le job en erreur
      await supabase
        .from("export_jobs")
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);
        
      throw error;
    }
  }

  /**
   * Génère une URL signée pour le téléchargement sécurisé.
   */
  static async getSignedUrl(jobId: string, userId: string): Promise<string> {
    const supabase = await createClient();
    
    const { data: job, error: jobError } = await supabase
      .from("export_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) throw new Error("Job non trouvé ou accès refusé.");
    if (job.status !== 'completed') throw new Error(`Le job est en statut: ${job.status}`);
    if (!job.storage_path) throw new Error("Aucun fichier généré pour ce job.");

    const { data, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(job.storage_path, 900); // 15 minutes TTL

    if (urlError) throw urlError;
    return data.signedUrl;
  }
}

