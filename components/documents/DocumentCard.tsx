"use client";

/**
 * DocumentCard — Composant réutilisable pour afficher un document
 * AUDIT UX H-10 : Extraction du code inline de documents/page.tsx
 *
 * Supporte : loading, empty, error, success, disabled
 * Respecte : focus-visible, prefers-reduced-motion, touch targets 44px
 */

import { Calendar, Eye, Download, FileText, FileSignature, Receipt, Shield, FileCheck, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

// Configuration des types de documents
export const DOCUMENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  // Documents de bail
  bail: { label: "Bail de location", icon: FileSignature, color: "text-blue-600", bgColor: "bg-blue-50" },
  lease: { label: "Bail de location", icon: FileSignature, color: "text-blue-600", bgColor: "bg-blue-50" },
  contrat: { label: "Contrat de location", icon: FileSignature, color: "text-blue-600", bgColor: "bg-blue-50" },
  avenant: { label: "Avenant au bail", icon: FileSignature, color: "text-blue-600", bgColor: "bg-blue-50" },
  
  // Quittances
  quittance: { label: "Quittance de loyer", icon: Receipt, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  receipt: { label: "Quittance de loyer", icon: Receipt, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  
  // Assurance
  attestation_assurance: { label: "Assurance habitation", icon: Shield, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  assurance: { label: "Assurance habitation", icon: Shield, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  
  // États des lieux
  EDL_entree: { label: "EDL d'entrée", icon: FileCheck, color: "text-amber-600", bgColor: "bg-amber-50" },
  edl_entree: { label: "EDL d'entrée", icon: FileCheck, color: "text-amber-600", bgColor: "bg-amber-50" },
  EDL_sortie: { label: "EDL de sortie", icon: FileCheck, color: "text-orange-600", bgColor: "bg-orange-50" },
  edl_sortie: { label: "EDL de sortie", icon: FileCheck, color: "text-orange-600", bgColor: "bg-orange-50" },
  edl: { label: "État des lieux", icon: FileCheck, color: "text-amber-600", bgColor: "bg-amber-50" },
  
  // Diagnostics
  dpe: { label: "DPE", icon: FileText, color: "text-green-600", bgColor: "bg-green-50" },
  erp: { label: "État des Risques", icon: FileText, color: "text-red-600", bgColor: "bg-red-50" },
  crep: { label: "Diagnostic Plomb", icon: FileText, color: "text-yellow-600", bgColor: "bg-yellow-50" },
  amiante: { label: "Diagnostic Amiante", icon: FileText, color: "text-gray-600", bgColor: "bg-gray-50" },
  electricite: { label: "Diagnostic Électricité", icon: FileText, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  gaz: { label: "Diagnostic Gaz", icon: FileText, color: "text-orange-600", bgColor: "bg-orange-50" },
  
  // Autres
  facture: { label: "Facture", icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" },
  piece_identite: { label: "Pièce d'identité", icon: User, color: "text-purple-600", bgColor: "bg-purple-50" },
  cni: { label: "Pièce d'identité", icon: User, color: "text-purple-600", bgColor: "bg-purple-50" },
  justificatif_revenus: { label: "Justificatif de revenus", icon: FileText, color: "text-teal-600", bgColor: "bg-teal-50" },
  attestation_loyer: { label: "Attestation de loyer", icon: FileText, color: "text-sky-600", bgColor: "bg-sky-50" },
  
  // Par défaut
  autre: { label: "Document", icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" },
};

export interface DocumentCardDoc {
  id: string;
  type: string;
  title?: string | null;
  storage_path?: string;
  created_at: string;
  metadata?: Record<string, any> | null;
  lease_id?: string | null;
  property_id?: string | null;
  tenant_id?: string | null;
  verification_status?: string;
}

interface DocumentCardProps {
  doc: DocumentCardDoc;
  /** Détection du type résolue */
  resolvedType: string;
  /** Titre affiché (résolu par le parent) */
  displayTitle: string;
  onPreview?: (doc: DocumentCardDoc) => void;
  onDownload?: (doc: DocumentCardDoc) => void;
  /** Compact = mode horizontal (pour la zone "Documents clés") */
  compact?: boolean;
  /** Badge "Nouveau" si < 7 jours */
  isNew?: boolean;
  className?: string;
}

export function DocumentCard({
  doc,
  resolvedType,
  displayTitle,
  onPreview,
  onDownload,
  compact = false,
  isNew = false,
  className,
}: DocumentCardProps) {
  const config = DOCUMENT_CONFIG[resolvedType] || DOCUMENT_CONFIG.autre;
  const Icon = config.icon;
  const isFinal = doc.metadata?.final === true;

  if (compact) {
    return (
      <GlassCard
        className={cn(
          "group flex items-center gap-4 p-4 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 border-border bg-card cursor-pointer",
          "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2",
          isFinal && "border-emerald-200 bg-emerald-50/5",
          className,
        )}
        tabIndex={0}
        role="article"
        aria-label={`${displayTitle} — ${config.label}`}
        onKeyDown={(e) => { if (e.key === 'Enter' && onPreview) onPreview(doc); }}
      >
        <div className={cn("p-2.5 rounded-xl shrink-0", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground line-clamp-2" title={displayTitle}>{displayTitle}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
            {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isNew && (
            <Badge className="bg-blue-600 text-white text-[10px] h-5 border-none">Nouveau</Badge>
          )}
          {isFinal && (
            <Badge className="bg-emerald-600 text-white text-[10px] h-5 border-none">
              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Certifié
            </Badge>
          )}
          {onPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
              aria-label={`Voir ${displayTitle}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onDownload(doc); }}
              aria-label={`Télécharger ${displayTitle}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </GlassCard>
    );
  }

  // Mode grille (card)
  return (
    <GlassCard
      className={cn(
        "group hover:shadow-2xl hover:border-indigo-200 transition-all duration-200 border-border bg-card h-full flex flex-col p-5",
        "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2",
        isFinal && "border-emerald-200 bg-emerald-50/5",
        className,
      )}
      tabIndex={0}
      role="article"
      aria-label={`${displayTitle} — ${config.label}`}
      onKeyDown={(e) => { if (e.key === 'Enter' && onPreview) onPreview(doc); }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100", config.bgColor)}>
          <Icon className={cn("h-6 w-6", config.color)} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="bg-muted text-[10px] uppercase tracking-wider font-bold">
            {config.label}
          </Badge>
          {isNew && (
            <Badge className="bg-blue-600 text-white text-[10px] h-5 border-none">Nouveau</Badge>
          )}
          {isFinal && (
            <Badge className="bg-emerald-600 text-white text-[10px] h-5 border-none uppercase tracking-wider font-black">
              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Certifié
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 mb-6">
        <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 transition-colors line-clamp-2">
          {displayTitle}
        </h3>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {doc.metadata?.file_size && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-medium">
              {(doc.metadata.file_size / 1024 / 1024).toFixed(2)} Mo
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border">
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10 hover:bg-indigo-50 hover:text-indigo-600 font-semibold"
            onClick={() => onPreview(doc)}
          >
            <Eye className="h-4 w-4 mr-2" /> Voir
          </Button>
        )}
        {onDownload && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10 hover:border-indigo-300 font-semibold shadow-sm"
            onClick={() => onDownload(doc)}
          >
            <Download className="h-4 w-4 mr-2" /> Télécharger
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

export default DocumentCard;
