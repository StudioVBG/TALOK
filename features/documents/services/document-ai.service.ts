import { documentAnalysisGraph, DocumentAnalysisState } from "../ai/document-analysis.graph";
import { createClient } from "@/lib/supabase/server";

export class DocumentAiService {
  
  /**
   * Trigger AI analysis for a document
   * This is typically called after a file upload or via a background job
   */
  async analyzeDocument(documentId: string, documentUrl: string, declaredType: string, tenantName?: string) {
    console.log(`[DocumentAiService] Starting analysis for ${documentId}`);

    const initialState: DocumentAnalysisState = {
      documentId,
      documentUrl,
      declaredType,
      tenantName,
      verificationStatus: 'pending'
    };

    try {
      // Run the LangGraph workflow
      const result = await documentAnalysisGraph.invoke(initialState as any) as unknown as DocumentAnalysisState;
      
      // Update the database with results
      await this.updateDocumentStatus(
        documentId, 
        result.verificationStatus || 'pending', 
        result.extractedData || {}, 
        result.rejectionReason
      );

      return result;
    } catch (error) {
      console.error("[DocumentAiService] Analysis failed:", error);
      // Fallback to manual review on error
      await this.updateDocumentStatus(documentId, 'manual_review_required', {}, "Erreur technique lors de l'analyse IA");
      throw error;
    }
  }

  private async updateDocumentStatus(
    documentId: string, 
    status: string, 
    analysis: any, 
    reason?: string
  ) {
    const supabase = await createClient();
    
    const updateData: any = {
      verification_status: status,
      ai_analysis: analysis,
      verified_at: new Date().toISOString()
    };

    if (reason) {
      updateData.rejection_reason = reason;
    }

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      console.error("[DocumentAiService] DB Update failed:", error);
      throw error;
    }
  }
}

export const documentAiService = new DocumentAiService();

