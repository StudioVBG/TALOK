"use client";
// @ts-nocheck

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, FileText, Calendar } from "lucide-react";
import { GedDocumentCard } from "./ged-document-card";
import { ExpiryBadge } from "./expiry-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { GedDocument, GedPropertyGroup } from "@/lib/types/ged";

interface QuickViewProps {
  documents: GedDocument[];
  isLoading: boolean;
  onPreview?: (doc: GedDocument) => void;
  onDownload?: (doc: GedDocument) => void;
  onDelete?: (doc: GedDocument) => void;
  onShare?: (doc: GedDocument) => void;
  className?: string;
}

/**
 * Vue rapide GED: Groupement par bien avec accordéon baux.
 * Vue par défaut pour les petits propriétaires (1-3 biens).
 */
export function QuickView({
  documents,
  isLoading,
  onPreview,
  onDownload,
  onDelete,
  onShare,
  className,
}: QuickViewProps) {
  // Grouper les documents par bien
  const propertyGroups = useMemo(() => {
    return groupByProperty(documents);
  }, [documents]);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2].map((i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (propertyGroups.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun document"
        description="Vos documents seront organisés par bien ici."
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {propertyGroups.map((group) => (
        <PropertyGroupCard
          key={group.property.id}
          group={group}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}

      {/* Documents sans bien */}
      {documents.filter((d) => !d.property_id).length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 bg-muted/30 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Documents généraux
            </h3>
          </div>
          <div className="p-3 grid gap-2 grid-cols-1 md:grid-cols-2">
            {documents
              .filter((d) => !d.property_id)
              .map((doc) => (
                <GedDocumentCard
                  key={doc.id}
                  document={doc}
                  compact
                  onPreview={onPreview}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  onShare={onShare}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyGroupCard({
  group,
  onPreview,
  onDownload,
  onDelete,
  onShare,
}: {
  group: GedPropertyGroup;
  onPreview?: (doc: GedDocument) => void;
  onDownload?: (doc: GedDocument) => void;
  onDelete?: (doc: GedDocument) => void;
  onShare?: (doc: GedDocument) => void;
}) {
  const totalDocs =
    group.propertyDocuments.length +
    group.leases.reduce((acc, l) => acc + l.documents.length, 0);

  const alertCount =
    group.propertyDocuments.filter(
      (d) => d.expiry_status === "expired" || d.expiry_status === "expiring_soon"
    ).length +
    group.leases.reduce(
      (acc, l) =>
        acc +
        l.documents.filter(
          (d) => d.expiry_status === "expired" || d.expiry_status === "expiring_soon"
        ).length,
      0
    );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Property header */}
      <div className="p-4 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {group.property.adresse_complete}
            <span className="text-muted-foreground font-normal">
              {group.property.ville}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {totalDocs} doc{totalDocs > 1 ? "s" : ""}
            </Badge>
            {alertCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertCount} alerte{alertCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Property-level documents (diagnostics, etc.) */}
      {group.propertyDocuments.length > 0 && (
        <div className="p-3 border-b bg-background">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Diagnostics & documents du bien
          </p>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
            {group.propertyDocuments.map((doc) => (
              <GedDocumentCard
                key={doc.id}
                document={doc}
                compact
                onPreview={onPreview}
                onDownload={onDownload}
                onDelete={onDelete}
                onShare={onShare}
              />
            ))}
          </div>
        </div>
      )}

      {/* Leases accordion */}
      {group.leases.length > 0 && (
        <Accordion type="multiple" defaultValue={[group.leases[0]?.lease.id]} className="px-3 pb-3">
          {group.leases.map(({ lease, documents: leaseDocs }) => (
            <AccordionItem key={lease.id} value={lease.id} className="border-b-0">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    Bail {lease.type_bail || ""}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {lease.date_debut}
                    {lease.date_fin ? ` - ${lease.date_fin}` : " (en cours)"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                    {leaseDocs.length} doc{leaseDocs.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2 pt-1">
                  {leaseDocs.map((doc) => (
                    <GedDocumentCard
                      key={doc.id}
                      document={doc}
                      compact
                      onPreview={onPreview}
                      onDownload={onDownload}
                      onDelete={onDelete}
                      onShare={onShare}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function groupByProperty(documents: GedDocument[]): GedPropertyGroup[] {
  const propertyMap = new Map<string, GedPropertyGroup>();

  for (const doc of documents) {
    if (!doc.property_id || !doc.property) continue;

    if (!propertyMap.has(doc.property_id)) {
      propertyMap.set(doc.property_id, {
        property: doc.property,
        leases: [],
        propertyDocuments: [],
      });
    }

    const group = propertyMap.get(doc.property_id)!;

    if (doc.lease_id) {
      // Document lié à un bail
      let leaseGroup = group.leases.find((l) => l.lease.id === doc.lease_id);
      if (!leaseGroup) {
        leaseGroup = {
          lease: doc.lease || {
            id: doc.lease_id,
            type_bail: "",
            date_debut: "",
            date_fin: null,
          },
          documents: [],
        };
        group.leases.push(leaseGroup);
      }
      leaseGroup.documents.push(doc);
    } else {
      // Document lié au bien directement (diagnostic, photo, etc.)
      group.propertyDocuments.push(doc);
    }
  }

  return Array.from(propertyMap.values());
}
