"use client";

/**
 * Composant SOTA 2025 pour l'affichage groupé des documents
 * 
 * Fonctionnalités :
 * - Regroupement par locataire ou par catégorie
 * - Affichage compact (CNI recto+verso ensemble)
 * - Expansion/collapse des groupes
 * - Actions groupées
 */

import { useState, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  User, 
  Home, 
  Download, 
  Eye, 
  Trash2,
  FolderOpen,
  Shield,
  CreditCard,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlassCard } from "@/components/ui/glass-card";
import { formatDateShort } from "@/lib/helpers/format";
import { DOCUMENT_TYPES } from "@/lib/owner/constants";
import { cn } from "@/lib/utils";

// Types
interface DocumentRow {
  id: string;
  type: string;
  title?: string | null;
  storage_path: string;
  created_at?: string;
  tenant_id?: string | null;
  owner_id?: string | null;
  property_id?: string | null;
  lease_id?: string | null;
  metadata?: Record<string, any> | null;
  verification_status?: string;
  expiry_date?: string | null;
  tenant?: {
    id: string;
    prenom: string | null;
    nom: string | null;
  } | null;
  properties?: {
    id: string;
    adresse_complete: string;
    ville: string;
  } | null;
}

interface DocumentGroupsProps {
  documents: DocumentRow[];
  groupBy?: "tenant" | "category" | "property";
  onPreview?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
}

// Configuration des catégories
const CATEGORY_CONFIG: Record<string, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  types: string[];
}> = {
  identite: {
    label: "Pièces d'identité",
    icon: User,
    color: "bg-slate-100 text-slate-700 border-slate-200",
    types: ["cni_recto", "cni_verso", "passeport", "piece_identite", "titre_sejour"],
  },
  contrat: {
    label: "Contrats & Baux",
    icon: FileCheck,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    types: ["bail", "avenant", "engagement_garant", "bail_signe_locataire", "bail_signe_proprietaire"],
  },
  finance: {
    label: "Finances",
    icon: CreditCard,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    types: ["quittance", "facture", "rib", "avis_imposition", "bulletin_paie", "attestation_loyer"],
  },
  assurance: {
    label: "Assurances",
    icon: Shield,
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    types: ["attestation_assurance", "assurance_pno"],
  },
  diagnostic: {
    label: "Diagnostics",
    icon: AlertTriangle,
    color: "bg-orange-100 text-orange-700 border-orange-200",
    types: ["dpe", "diagnostic", "diagnostic_gaz", "diagnostic_electricite", "diagnostic_plomb", "erp"],
  },
  edl: {
    label: "États des lieux",
    icon: Home,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    types: ["EDL_entree", "EDL_sortie", "inventaire"],
  },
  autre: {
    label: "Autres documents",
    icon: FolderOpen,
    color: "bg-gray-100 text-gray-700 border-gray-200",
    types: [],
  },
};

// Fonction pour obtenir la catégorie d'un document
function getDocumentCategory(type: string): string {
  for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
    if (config.types.includes(type)) return category;
  }
  return "autre";
}

// Fonction pour obtenir le nom du locataire
function getTenantName(doc: DocumentRow): string {
  if (doc.tenant?.prenom || doc.tenant?.nom) {
    return `${doc.tenant.prenom || ""} ${doc.tenant.nom || ""}`.trim();
  }
  if (doc.metadata?.prenom || doc.metadata?.nom) {
    return `${doc.metadata.prenom || ""} ${doc.metadata.nom || ""}`.trim();
  }
  return "Locataire inconnu";
}

// Composant pour un groupe de documents
function DocumentGroup({ 
  title, 
  subtitle,
  icon: Icon,
  badgeColor,
  documents, 
  defaultExpanded = true,
  onPreview,
  onDownload,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badgeColor: string;
  documents: DocumentRow[];
  defaultExpanded?: boolean;
  onPreview?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Regrouper CNI recto+verso ensemble (priorité lease_id, puis tenant_id, avec dédup)
  const groupedDocs = useMemo(() => {
    const cniRectos = documents.filter(d => d.type === "cni_recto");
    const cniVersos = documents.filter(d => d.type === "cni_verso");
    const others = documents.filter(d => !["cni_recto", "cni_verso"].includes(d.type));

    const cniPairs: { recto?: DocumentRow; verso?: DocumentRow }[] = [];
    const matchedVersoIds = new Set<string>();

    cniRectos.forEach(recto => {
      const matchingVerso =
        cniVersos.find(v =>
          !matchedVersoIds.has(v.id) &&
          v.lease_id != null &&
          v.lease_id === recto.lease_id
        ) ||
        cniVersos.find(v =>
          !matchedVersoIds.has(v.id) &&
          v.tenant_id != null &&
          v.tenant_id === recto.tenant_id
        );
      if (matchingVerso) matchedVersoIds.add(matchingVerso.id);
      cniPairs.push({ recto, verso: matchingVerso });
    });

    cniVersos.forEach(verso => {
      if (!matchedVersoIds.has(verso.id)) {
        cniPairs.push({ verso });
      }
    });

    return { cniPairs, others };
  }, [documents]);

  return (
    <GlassCard className="overflow-hidden">
      {/* En-tête du groupe */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
        aria-expanded={expanded}
        aria-controls={`group-content-${title.replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", badgeColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {documents.length} doc{documents.length > 1 ? "s" : ""}
          </Badge>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Contenu */}
      {expanded && (
        <div 
          id={`group-content-${title.replace(/\s+/g, '-')}`}
          className="border-t border-slate-100 p-4 space-y-3"
          role="region"
          aria-label={`Documents de ${title}`}
        >
          {/* CNI groupées */}
          {groupedDocs.cniPairs.map((pair) => (
            <div key={`cni-pair-${pair.recto?.id || pair.verso?.id}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1 grid grid-cols-2 gap-3">
                {pair.recto && (
                  <DocumentMiniCard 
                    doc={pair.recto} 
                    onPreview={onPreview}
                    onDownload={onDownload}
                    onDelete={onDelete}
                  />
                )}
                {pair.verso && (
                  <DocumentMiniCard 
                    doc={pair.verso} 
                    onPreview={onPreview}
                    onDownload={onDownload}
                    onDelete={onDelete}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Autres documents */}
          {groupedDocs.others.map(doc => (
            <DocumentMiniCard 
              key={doc.id}
              doc={doc} 
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// Mini carte pour un document
function DocumentMiniCard({
  doc,
  onPreview,
  onDownload,
  onDelete,
}: {
  doc: DocumentRow;
  onPreview?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
}) {
  const typeLabel = (DOCUMENT_TYPES as Record<string, string>)[doc.type] || doc.type;
  const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
  const isExpiringSoon = doc.expiry_date && !isExpired && 
    new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <FileText className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-sm text-slate-900 truncate max-w-[200px]">
            {doc.title || typeLabel}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {doc.created_at ? formatDateShort(doc.created_at) : "-"}
            </span>
            {isExpired && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Expiré
              </Badge>
            )}
            {isExpiringSoon && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                Expire bientôt
              </Badge>
            )}
            {doc.verification_status === "pending" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                En attente
              </Badge>
            )}
            {doc.verification_status === "verified" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-600">
                Vérifié
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Actions sur le document">
        {onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => onPreview(doc)}
            aria-label={`Prévisualiser ${doc.title || typeLabel}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => onDownload(doc)}
            aria-label={`Télécharger ${doc.title || typeLabel}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 hover:bg-red-50 hover:text-red-600"
            onClick={() => onDelete(doc)}
            aria-label={`Supprimer ${doc.title || typeLabel}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Composant principal
export function DocumentGroups({
  documents,
  groupBy = "tenant",
  onPreview,
  onDownload,
  onDelete,
}: DocumentGroupsProps) {
  const groups = useMemo(() => {
    if (groupBy === "tenant") {
      // Grouper par locataire
      const byTenant = new Map<string, { tenant: DocumentRow["tenant"]; docs: DocumentRow[] }>();
      
      documents.forEach(doc => {
        const key = doc.tenant_id || "unknown";
        if (!byTenant.has(key)) {
          byTenant.set(key, { tenant: doc.tenant, docs: [] });
        }
        byTenant.get(key)!.docs.push(doc);
      });
      
      return Array.from(byTenant.entries()).map(([key, { tenant, docs }]) => ({
        id: key,
        title: tenant ? `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() : "Documents généraux",
        subtitle: docs[0]?.properties?.adresse_complete,
        icon: User,
        color: "bg-slate-100 text-slate-700",
        documents: docs,
      }));
    }
    
    if (groupBy === "category") {
      // Grouper par catégorie
      const byCategory = new Map<string, DocumentRow[]>();
      
      documents.forEach(doc => {
        const category = getDocumentCategory(doc.type);
        if (!byCategory.has(category)) {
          byCategory.set(category, []);
        }
        byCategory.get(category)!.push(doc);
      });
      
      return Array.from(byCategory.entries()).map(([category, docs]) => {
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.autre;
        return {
          id: category,
          title: config.label,
          icon: config.icon,
          color: config.color,
          documents: docs,
        };
      });
    }
    
    if (groupBy === "property") {
      // Grouper par propriété
      const byProperty = new Map<string, { property: DocumentRow["properties"]; docs: DocumentRow[] }>();
      
      documents.forEach(doc => {
        const key = doc.property_id || "general";
        if (!byProperty.has(key)) {
          byProperty.set(key, { property: doc.properties, docs: [] });
        }
        byProperty.get(key)!.docs.push(doc);
      });
      
      return Array.from(byProperty.entries()).map(([key, { property, docs }]) => ({
        id: key,
        title: property?.adresse_complete || "Documents généraux",
        subtitle: property?.ville,
        icon: Home,
        color: "bg-indigo-100 text-indigo-700",
        documents: docs,
      }));
    }
    
    return [];
  }, [documents, groupBy]);

  if (documents.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Aucun document</h3>
        <p className="text-muted-foreground mt-1">
          Les documents apparaîtront ici une fois téléversés.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <DocumentGroup
          key={group.id}
          title={group.title}
          subtitle={(group as any).subtitle}
          icon={group.icon}
          badgeColor={group.color}
          documents={group.documents}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default DocumentGroups;

