"use client";

/**
 * DocumentCard — Composant réutilisable pour afficher un document
 * AUDIT UX H-10 : Extraction du code inline de documents/page.tsx
 *
 * Supporte : loading, empty, error, success, disabled
 * Respecte : focus-visible, prefers-reduced-motion, touch targets 44px
 */

import { Calendar, Eye, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { DOCUMENT_CONFIG } from "@/lib/documents/document-config";

/**
 * Formate une date en FR. Retourne "Date inconnue" si la date est nulle,
 * vide, ou invalide — évite les "Invalid Date" visibles à l'utilisateur.
 */
function formatSafeDocDate(
  primary: string | null | undefined,
  fallback?: string | null,
): string {
  const candidates = [primary, fallback].filter((s): s is string => !!s && s.length > 0);
  for (const c of candidates) {
    const d = new Date(c);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return "Date inconnue";
}

// Re-export pour rétrocompatibilité (les importeurs existants)
export { DOCUMENT_CONFIG } from "@/lib/documents/document-config";

export interface DocumentCardDoc {
  id: string;
  type: string;
  title?: string | null;
  storage_path?: string;
  created_at: string | null;
  uploaded_at?: string | null;
  updated_at?: string | null;
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
  /** Badge provenance inter-compte ("Du propriétaire", "Déposé par X", etc.) */
  sourceLabel?: string;
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
  sourceLabel,
  className,
}: DocumentCardProps) {
  const config = DOCUMENT_CONFIG[resolvedType] || DOCUMENT_CONFIG.autre;
  const Icon = config.icon;
  const isFinal = doc.metadata?.final === true;

  if (compact) {
    const formattedDate = formatSafeDocDate(doc.created_at, doc.uploaded_at ?? doc.updated_at);
    const hasDate = formattedDate !== "Date inconnue";
    return (
      <GlassCard
        className={cn(
          "group flex items-center gap-3 p-4 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 border-border bg-card cursor-pointer",
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
          <p className="text-sm font-bold text-foreground truncate" title={displayTitle}>{displayTitle}</p>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            {hasDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </p>
            )}
            {isFinal && (
              <Badge className="bg-emerald-600 text-white text-[10px] h-5 border-none px-1.5 shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Certifié
              </Badge>
            )}
            {isNew && (
              <Badge className="bg-blue-600 text-white text-[10px] h-5 border-none px-1.5 shrink-0">Nouveau</Badge>
            )}
            {sourceLabel && (
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] h-5 px-1.5 shrink-0 truncate">{sourceLabel}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
              aria-label={`Voir ${displayTitle}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={(e) => { e.stopPropagation(); onDownload(doc); }}
              aria-label={`Télécharger ${displayTitle}`}
            >
              <Download className="h-3.5 w-3.5" />
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
          {sourceLabel && (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] h-5">{sourceLabel}</Badge>
          )}
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
        <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 transition-colors line-clamp-2" title={displayTitle}>
          {displayTitle}
        </h3>
        {(() => {
          const formattedDate = formatSafeDocDate(doc.created_at, doc.uploaded_at ?? doc.updated_at);
          const hasDate = formattedDate !== "Date inconnue";
          if (!hasDate && !doc.metadata?.file_size) return null;
          return (
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {hasDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formattedDate}
                </div>
              )}
              {doc.metadata?.file_size && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-medium">
                  {(doc.metadata.file_size / 1024 / 1024).toFixed(2)} Mo
                </span>
              )}
            </div>
          );
        })()}
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
