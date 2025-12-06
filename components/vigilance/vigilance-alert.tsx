'use client';

// =====================================================
// Composant d'alerte de vigilance
// Affiche les obligations légales pour les devis > 5000€ HT
// =====================================================

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { VigilanceCheckResult } from '@/lib/data/legal-thresholds';
import { VIGILANCE_LEGAL_MESSAGES, formatAmount } from '@/lib/data/legal-thresholds';

interface VigilanceAlertProps {
  result: VigilanceCheckResult;
  onRequestDocuments?: () => void;
  onProceedAnyway?: (reason: string) => void;
  showDetails?: boolean;
  className?: string;
}

export function VigilanceAlert({
  result,
  onRequestDocuments,
  onProceedAnyway,
  showDetails = true,
  className = '',
}: VigilanceAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  
  // Ne rien afficher si pas de vigilance requise
  if (!result.isRequired) {
    return null;
  }
  
  // Conforme : afficher un badge de confirmation
  if (result.isCompliant) {
    return (
      <Alert className={`border-green-200 bg-green-50 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Conformité vérifiée</AlertTitle>
        <AlertDescription className="text-green-700">
          Les documents de vigilance du prestataire sont à jour. 
          Vous pouvez accepter ce devis en toute sécurité.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Non conforme : afficher l'alerte complète
  return (
    <Card className={`border-amber-300 bg-amber-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <CardTitle className="text-amber-800 text-lg">
              Obligation de vigilance
            </CardTitle>
            <CardDescription className="text-amber-700 mt-1">
              Montant : {formatAmount(result.amount)} HT — Seuil : {formatAmount(result.threshold)} HT
            </CardDescription>
          </div>
          <Badge variant="destructive" className="bg-red-500">
            Action requise
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Message principal */}
        <div className="text-sm text-amber-800 space-y-2">
          <p className="font-medium">
            {VIGILANCE_LEGAL_MESSAGES.warning}
          </p>
          <p>
            {VIGILANCE_LEGAL_MESSAGES.liability}
          </p>
        </div>
        
        {/* Documents manquants/expirés */}
        {showDetails && (
          <div className="space-y-3">
            {result.missingDocuments.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-red-700">Documents manquants :</span>
                  <ul className="list-disc list-inside ml-2 text-red-600">
                    {result.missingDocuments.map(doc => (
                      <li key={doc}>
                        {doc === 'urssaf' ? 'Attestation de vigilance URSSAF' : 
                         doc === 'kbis' ? 'Extrait Kbis (ou INSEE)' : doc}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {result.expiredDocuments.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-orange-700">Documents expirés :</span>
                  <ul className="list-disc list-inside ml-2 text-orange-600">
                    {result.expiredDocuments.map(doc => (
                      <li key={doc.type}>
                        {doc.type === 'urssaf' ? 'Attestation URSSAF' : 
                         doc.type === 'kbis' ? 'Extrait Kbis' : doc.type}
                        {' '} (expiré le {new Date(doc.expiredAt).toLocaleDateString('fr-FR')})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {result.validDocuments.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-green-700">Documents valides :</span>
                  <ul className="list-disc list-inside ml-2 text-green-600">
                    {result.validDocuments.map(doc => (
                      <li key={doc.type}>
                        {doc.type === 'urssaf' ? 'Attestation URSSAF' : 
                         doc.type === 'kbis' ? 'Extrait Kbis' : doc.type}
                        {doc.validUntil !== 'N/A' && ` (valide jusqu'au ${new Date(doc.validUntil).toLocaleDateString('fr-FR')})`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Détails légaux (collapsible) */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 p-0 h-auto">
              {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isExpanded ? 'Masquer les détails légaux' : 'Voir les détails légaux'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="bg-white/50 rounded-lg p-3 text-sm text-amber-900 space-y-2">
              <p>
                <strong>Référence légale :</strong> {VIGILANCE_LEGAL_MESSAGES.legalReference}
              </p>
              <p>
                Au-delà de 5 000 € HT de prestation (ou par année civile avec le même prestataire), 
                le donneur d'ordre est tenu de vérifier que le cocontractant s'acquitte de ses 
                obligations de déclaration et de paiement des cotisations sociales.
              </p>
              <p>
                <strong>Sanctions :</strong> En cas de travail dissimulé, le donneur d'ordre peut être 
                tenu solidairement responsable du paiement des cotisations sociales et fiscales éludées, 
                ainsi que des pénalités et majorations de retard.
              </p>
              <a 
                href="https://www.urssaf.fr/portail/home/employeur/declarer-et-payer/les-sanctions/la-lutte-contre-le-travail-luftte-contre-le-travail-il.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                En savoir plus sur urssaf.fr
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200">
          {onRequestDocuments && (
            <Button 
              onClick={onRequestDocuments}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Demander les documents au prestataire
            </Button>
          )}
          
          {onProceedAnyway && (
            <>
              {!showOverrideForm ? (
                <Button 
                  variant="outline" 
                  onClick={() => setShowOverrideForm(true)}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  Passer outre (non recommandé)
                </Button>
              ) : (
                <div className="w-full mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-2 font-medium">
                    ⚠️ En passant outre, vous acceptez la responsabilité légale en cas de travail dissimulé.
                  </p>
                  <textarea
                    placeholder="Justification obligatoire..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full p-2 text-sm border rounded mb-2 min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (overrideReason.trim().length >= 20) {
                          onProceedAnyway(overrideReason);
                        }
                      }}
                      disabled={overrideReason.trim().length < 20}
                    >
                      Confirmer (je comprends les risques)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOverrideForm(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                  {overrideReason.trim().length > 0 && overrideReason.trim().length < 20 && (
                    <p className="text-xs text-red-500 mt-1">
                      Justification trop courte (minimum 20 caractères)
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Version compacte pour les listes
 */
export function VigilanceAlertCompact({
  result,
  className = '',
}: {
  result: VigilanceCheckResult;
  className?: string;
}) {
  if (!result.isRequired) return null;
  
  if (result.isCompliant) {
    return (
      <Badge variant="outline" className={`border-green-300 text-green-700 ${className}`}>
        <CheckCircle className="h-3 w-3 mr-1" />
        Vigilance OK
      </Badge>
    );
  }
  
  return (
    <Badge variant="destructive" className={className}>
      <AlertTriangle className="h-3 w-3 mr-1" />
      Documents manquants
    </Badge>
  );
}

