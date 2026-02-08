"use client";
// @ts-nocheck

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Download, Eye, Trash2, MoreVertical, Share2,
  Calendar, Building2, Tag, Clock,
} from "lucide-react";
import { ExpiryBadge } from "./expiry-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateShort } from "@/lib/helpers/format";
import type { GedDocument } from "@/lib/types/ged";
import { GED_STATUS_LABELS, GED_STATUS_COLORS } from "@/lib/types/ged";

interface GedDocumentCardProps {
  document: GedDocument;
  onPreview?: (doc: GedDocument) => void;
  onDownload?: (doc: GedDocument) => void;
  onDelete?: (doc: GedDocument) => void;
  onShare?: (doc: GedDocument) => void;
  compact?: boolean;
  className?: string;
}

export function GedDocumentCard({
  document: doc,
  onPreview,
  onDownload,
  onDelete,
  onShare,
  compact = false,
  className,
}: GedDocumentCardProps) {
  const title = doc.title || doc.type_label || doc.original_filename || "Document sans titre";
  const subtitle = doc.type_label_short || doc.type_label || doc.type;
  const isPdf = doc.mime_type?.includes("pdf");
  const isImage = doc.mime_type?.startsWith("image/");

  const fileSize = doc.file_size
    ? doc.file_size > 1024 * 1024
      ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} Mo`
      : `${Math.round(doc.file_size / 1024)} Ko`
    : null;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card/80 backdrop-blur-sm",
          "hover:bg-accent/50 transition-colors cursor-pointer group",
          className
        )}
        onClick={() => onPreview?.(doc)}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        {doc.expiry_status && doc.expiry_status !== "valid" && (
          <ExpiryBadge
            status={doc.expiry_status}
            daysUntilExpiry={doc.days_until_expiry}
            showDays={false}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem onClick={() => onPreview(doc)}>
                <Eye className="mr-2 h-4 w-4" /> Voir
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onClick={() => onDownload(doc)}>
                <Download className="mr-2 h-4 w-4" /> Télécharger
              </DropdownMenuItem>
            )}
            {onShare && (
              <DropdownMenuItem onClick={() => onShare(doc)}>
                <Share2 className="mr-2 h-4 w-4" /> Partager
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(doc)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 backdrop-blur-sm overflow-hidden",
        "hover:shadow-md transition-shadow group",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold truncate leading-tight">{title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onPreview && (
                <DropdownMenuItem onClick={() => onPreview(doc)}>
                  <Eye className="mr-2 h-4 w-4" /> Voir
                </DropdownMenuItem>
              )}
              {onDownload && (
                <DropdownMenuItem onClick={() => onDownload(doc)}>
                  <Download className="mr-2 h-4 w-4" /> Télécharger
                </DropdownMenuItem>
              )}
              {onShare && (
                <DropdownMenuItem onClick={() => onShare(doc)}>
                  <Share2 className="mr-2 h-4 w-4" /> Partager
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(doc)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {doc.ged_status && doc.ged_status !== "active" && (
          <StatusBadge
            status={GED_STATUS_LABELS[doc.ged_status]}
            type={GED_STATUS_COLORS[doc.ged_status]}
            animate={false}
          />
        )}
        {doc.expiry_status && doc.expiry_status !== "valid" && (
          <ExpiryBadge
            status={doc.expiry_status}
            daysUntilExpiry={doc.days_until_expiry}
          />
        )}
        {doc.is_mandatory_for_lease && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">Obligatoire</Badge>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {doc.property?.adresse_complete && (
            <span className="flex items-center gap-1 truncate max-w-[160px]">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{doc.property.ville || doc.property.adresse_complete}</span>
            </span>
          )}
          {doc.valid_until && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateShort(doc.valid_until)}
            </span>
          )}
          {fileSize && (
            <span>{fileSize}</span>
          )}
        </div>
        {doc.version > 1 && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">v{doc.version}</Badge>
        )}
      </div>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-1">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {doc.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {doc.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Quick Actions (bottom) */}
      <div className="border-t px-2 py-1.5 flex items-center gap-1">
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 flex-1"
            onClick={() => onPreview(doc)}
          >
            <Eye className="h-3 w-3" /> Voir
          </Button>
        )}
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 flex-1"
            onClick={() => onDownload(doc)}
          >
            <Download className="h-3 w-3" /> Télécharger
          </Button>
        )}
      </div>
    </div>
  );
}
