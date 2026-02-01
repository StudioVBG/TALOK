// =====================================================
// Service de vérification de vigilance
// Conformité Article L.8222-1 du Code du travail
// =====================================================

import { createClient } from '@/lib/supabase/client';
import {
  VIGILANCE_THRESHOLD_HT,
  VIGILANCE_REQUIRED_DOCUMENTS,
  VIGILANCE_DOCUMENT_MAX_AGE,
  VIGILANCE_LEGAL_MESSAGES,
  type VigilanceCheckResult,
  type VigilanceStatus,
  formatAmount,
} from '@/lib/data/legal-thresholds';

/**
 * Vérifie la conformité de vigilance pour une prestation
 * 
 * @param providerId - ID du profil prestataire
 * @param amountHT - Montant HT de la prestation
 * @param ownerId - ID du profil propriétaire (pour calcul cumul annuel)
 * @returns Résultat de la vérification
 */
export async function checkVigilanceCompliance(
  providerId: string,
  amountHT: number,
  ownerId?: string
): Promise<VigilanceCheckResult> {
  const supabase = createClient();
  
  // Résultat par défaut si sous le seuil
  if (amountHT < VIGILANCE_THRESHOLD_HT) {
    return {
      isRequired: false,
      isCompliant: true,
      status: 'not_required',
      amount: amountHT,
      threshold: VIGILANCE_THRESHOLD_HT,
      missingDocuments: [],
      expiredDocuments: [],
      validDocuments: [],
      canProceed: true,
      requiredActions: [],
    };
  }
  
  // Récupérer les documents de compliance du prestataire
  const { data: documents, error: docsError } = await supabase
    .from('provider_compliance_documents')
    .select('*')
    .eq('provider_profile_id', providerId)
    .in('document_type', VIGILANCE_REQUIRED_DOCUMENTS);
  
  if (docsError) {
    console.error('Erreur récupération documents compliance:', docsError);
    return createBlockedResult(amountHT, 'Erreur de vérification des documents');
  }
  
  // Analyser les documents
  const now = new Date();
  const missingDocuments: string[] = [];
  const expiredDocuments: Array<{ type: string; expiredAt: string }> = [];
  const validDocuments: Array<{ type: string; validUntil: string }> = [];
  
  for (const docType of VIGILANCE_REQUIRED_DOCUMENTS) {
    const doc = documents?.find(d => d.document_type === docType);
    
    if (!doc) {
      missingDocuments.push(docType);
      continue;
    }
    
    // Vérifier le statut de vérification
    if (doc.verification_status !== 'verified') {
      missingDocuments.push(docType);
      continue;
    }
    
    // Vérifier l'expiration
    if (doc.expiration_date) {
      const expDate = new Date(doc.expiration_date as string);
      if (expDate < now) {
        expiredDocuments.push({
          type: docType,
          expiredAt: doc.expiration_date as string,
        });
        continue;
      }
      validDocuments.push({
        type: docType,
        validUntil: doc.expiration_date as string,
      });
    } else {
      // Calculer l'expiration basée sur la date d'émission
      if (doc.issue_date && docType in VIGILANCE_DOCUMENT_MAX_AGE) {
        const issueDate = new Date(doc.issue_date as string);
        const maxAge = VIGILANCE_DOCUMENT_MAX_AGE[docType as keyof typeof VIGILANCE_DOCUMENT_MAX_AGE];
        const calculatedExpiry = new Date(issueDate);
        calculatedExpiry.setMonth(calculatedExpiry.getMonth() + maxAge);
        
        if (calculatedExpiry < now) {
          expiredDocuments.push({
            type: docType,
            expiredAt: calculatedExpiry.toISOString(),
          });
          continue;
        }
        validDocuments.push({
          type: docType,
          validUntil: calculatedExpiry.toISOString(),
        });
      } else {
        // Document sans date d'expiration connue, considéré valide
        validDocuments.push({
          type: docType,
          validUntil: 'N/A',
        });
      }
    }
  }
  
  // Calculer le cumul annuel si ownerId fourni
  let yearlyTotal: number | undefined;
  if (ownerId) {
    yearlyTotal = await calculateYearlyTotal(providerId, ownerId);
    yearlyTotal += amountHT;
  }
  
  // Déterminer le statut
  const hasIssues = missingDocuments.length > 0 || expiredDocuments.length > 0;
  const isCompliant = !hasIssues;
  
  let status: VigilanceStatus;
  if (isCompliant) {
    status = 'compliant';
  } else if (validDocuments.length > 0) {
    status = 'partial';
  } else {
    status = 'non_compliant';
  }
  
  // Construire les messages
  const warningMessages: string[] = [];
  const requiredActions: string[] = [];
  
  if (!isCompliant) {
    warningMessages.push(VIGILANCE_LEGAL_MESSAGES.warning);
    warningMessages.push(VIGILANCE_LEGAL_MESSAGES.liability);
    
    if (missingDocuments.includes('urssaf')) {
      warningMessages.push(VIGILANCE_LEGAL_MESSAGES.missingUrssaf);
      requiredActions.push('Fournir une attestation de vigilance URSSAF valide');
    }
    
    if (missingDocuments.includes('kbis')) {
      warningMessages.push(VIGILANCE_LEGAL_MESSAGES.missingKbis);
      requiredActions.push('Fournir un extrait Kbis de moins de 3 mois');
    }
    
    for (const expired of expiredDocuments) {
      requiredActions.push(`Renouveler le document ${getDocumentLabel(expired.type)}`);
    }
  }
  
  return {
    isRequired: true,
    isCompliant,
    status,
    amount: amountHT,
    threshold: VIGILANCE_THRESHOLD_HT,
    yearlyTotal,
    missingDocuments,
    expiredDocuments,
    validDocuments,
    warningMessage: warningMessages.join('\n\n'),
    legalNotice: VIGILANCE_LEGAL_MESSAGES.legalReference,
    canProceed: isCompliant,
    requiredActions,
  };
}

/**
 * Calcule le cumul annuel des prestations entre un propriétaire et un prestataire
 */
async function calculateYearlyTotal(
  providerId: string,
  ownerId: string
): Promise<number> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  
  // Récupérer les work_orders payés de l'année
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select(`
      cout_final,
      tickets!inner (
        properties!inner (
          owner_id
        )
      )
    `)
    .eq('provider_id', providerId)
    .eq('tickets.properties.owner_id', ownerId)
    .gte('created_at', startOfYear)
    .in('statut', ['fully_paid', 'closed']);
  
  if (error || !workOrders) {
    console.error('Erreur calcul cumul annuel:', error);
    return 0;
  }
  
  return workOrders.reduce((sum, wo) => sum + (wo.cout_final || 0), 0);
}

/**
 * Crée un résultat de blocage
 */
function createBlockedResult(amount: number, message: string): VigilanceCheckResult {
  return {
    isRequired: true,
    isCompliant: false,
    status: 'non_compliant',
    amount,
    threshold: VIGILANCE_THRESHOLD_HT,
    missingDocuments: VIGILANCE_REQUIRED_DOCUMENTS as unknown as string[],
    expiredDocuments: [],
    validDocuments: [],
    warningMessage: message,
    legalNotice: VIGILANCE_LEGAL_MESSAGES.legalReference,
    canProceed: false,
    requiredActions: ['Vérifier manuellement les documents du prestataire'],
  };
}

/**
 * Retourne le label d'un type de document
 */
function getDocumentLabel(type: string): string {
  const labels: Record<string, string> = {
    urssaf: 'Attestation URSSAF',
    kbis: 'Extrait Kbis',
  };
  return labels[type] || type;
}

/**
 * Vérifie la vigilance côté serveur (pour les API routes)
 */
export async function checkVigilanceServer(
  supabase: ReturnType<typeof createClient>,
  providerId: string,
  amountHT: number,
  ownerId?: string
): Promise<VigilanceCheckResult> {
  // Même logique mais avec le client Supabase fourni
  if (amountHT < VIGILANCE_THRESHOLD_HT) {
    return {
      isRequired: false,
      isCompliant: true,
      status: 'not_required',
      amount: amountHT,
      threshold: VIGILANCE_THRESHOLD_HT,
      missingDocuments: [],
      expiredDocuments: [],
      validDocuments: [],
      canProceed: true,
      requiredActions: [],
    };
  }
  
  const { data: documents } = await supabase
    .from('provider_compliance_documents')
    .select('*')
    .eq('provider_profile_id', providerId)
    .in('document_type', VIGILANCE_REQUIRED_DOCUMENTS);
  
  const now = new Date();
  const missingDocuments: string[] = [];
  const expiredDocuments: Array<{ type: string; expiredAt: string }> = [];
  const validDocuments: Array<{ type: string; validUntil: string }> = [];
  
  for (const docType of VIGILANCE_REQUIRED_DOCUMENTS) {
    const doc = documents?.find(d => d.document_type === docType);
    
    if (!doc || doc.verification_status !== 'verified') {
      missingDocuments.push(docType);
      continue;
    }
    
    if (doc.expiration_date) {
      const expDate = new Date(doc.expiration_date as string);
      if (expDate < now) {
        expiredDocuments.push({ type: docType, expiredAt: doc.expiration_date as string });
      } else {
        validDocuments.push({ type: docType, validUntil: doc.expiration_date as string });
      }
    } else {
      validDocuments.push({ type: docType, validUntil: 'N/A' });
    }
  }
  
  const hasIssues = missingDocuments.length > 0 || expiredDocuments.length > 0;
  
  return {
    isRequired: true,
    isCompliant: !hasIssues,
    status: hasIssues ? 'non_compliant' : 'compliant',
    amount: amountHT,
    threshold: VIGILANCE_THRESHOLD_HT,
    missingDocuments,
    expiredDocuments,
    validDocuments,
    warningMessage: hasIssues ? VIGILANCE_LEGAL_MESSAGES.warning : undefined,
    legalNotice: VIGILANCE_LEGAL_MESSAGES.legalReference,
    canProceed: !hasIssues,
    requiredActions: hasIssues ? ['Vérifier les documents du prestataire'] : [],
  };
}

/**
 * Enregistre une vérification de vigilance dans le log d'audit
 */
export async function logVigilanceCheck(
  supabase: ReturnType<typeof createClient>,
  data: {
    owner_id: string;
    provider_id: string;
    quote_id?: string;
    work_order_id?: string;
    amount_ht: number;
    result: VigilanceCheckResult;
    action_taken: 'approved' | 'blocked' | 'override';
    override_reason?: string;
  }
): Promise<void> {
  try {
    await supabase.from('vigilance_audit_log').insert({
      owner_profile_id: data.owner_id,
      provider_profile_id: data.provider_id,
      quote_id: data.quote_id,
      work_order_id: data.work_order_id,
      amount_ht: data.amount_ht,
      threshold_ht: VIGILANCE_THRESHOLD_HT,
      is_required: data.result.isRequired,
      is_compliant: data.result.isCompliant,
      missing_documents: data.result.missingDocuments,
      expired_documents: data.result.expiredDocuments.map(d => d.type),
      action_taken: data.action_taken,
      override_reason: data.override_reason,
    });
  } catch (error) {
    console.error('Erreur log vigilance:', error);
  }
}

