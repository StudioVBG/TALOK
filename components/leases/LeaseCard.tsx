"use client";

import { memo } from "react";
import Link from "next/link";
import { Home, Calendar, Euro, Users, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface LeaseCardProps {
  lease: {
    id: string;
    type_bail: string;
    loyer: number;
    charges_forfaitaires?: number;
    date_debut: string;
    date_fin?: string;
    statut: string;
    property?: {
      adresse_complete: string;
      ville: string;
      code_postal: string;
    };
    tenant_name?: string;
  };
  href?: string;
  className?: string;
  onClick?: () => void;
}

// Labels des types de bail
const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  mobilite: "Bail mobilité",
  parking: "Parking",
  etudiant: "Étudiant",
};

// Couleurs des statuts
const STATUS_CONFIG: Record<string, { status: "success" | "warning" | "error" | "info" | "neutral"; label: string }> = {
  active: { status: "success", label: "Actif" },
  pending_signature: { status: "warning", label: "En attente" },
  draft: { status: "neutral", label: "Brouillon" },
  terminated: { status: "error", label: "Terminé" },
  expired: { status: "error", label: "Expiré" },
};

/**
 * Composant LeaseCard mémorisé pour les listes de baux
 */
export const LeaseCard = memo(function LeaseCard({
  lease,
  href,
  className,
  onClick,
}: LeaseCardProps) {
  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;
  const totalRent = lease.loyer + (lease.charges_forfaitaires || 0);

  const content = (
    <Card
      className={cn(
        "group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-4">
        {/* Header with type and status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Badge variant="secondary" className="text-xs">
                {LEASE_TYPE_LABELS[lease.type_bail] || lease.type_bail}
              </Badge>
            </div>
          </div>
          <StatusBadge status={statusConfig.status} size="sm">
            {statusConfig.label}
          </StatusBadge>
        </div>

        {/* Property info */}
        {lease.property && (
          <div className="flex items-start gap-2">
            <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                {lease.property.adresse_complete}
              </p>
              <p className="text-xs text-muted-foreground">
                {lease.property.code_postal} {lease.property.ville}
              </p>
            </div>
          </div>
        )}

        {/* Tenant */}
        {lease.tenant_name && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{lease.tenant_name}</span>
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Début: {formatDateShort(lease.date_debut)}</span>
          </div>
          {lease.date_fin && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Fin: {formatDateShort(lease.date_fin)}</span>
            </div>
          )}
        </div>

        {/* Rent */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="text-sm text-muted-foreground">Loyer mensuel</div>
          <div className="font-semibold text-lg flex items-center gap-1">
            <Euro className="h-4 w-4" />
            {formatCurrency(totalRent)}
            <span className="text-xs font-normal text-muted-foreground">CC</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
});

/**
 * Version compacte pour les tableaux
 */
export const LeaseCardCompact = memo(function LeaseCardCompact({
  lease,
  href,
  className,
  onClick,
}: LeaseCardProps) {
  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;

  const content = (
    <Card
      className={cn(
        "group hover:shadow-md transition-all duration-200 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs shrink-0">
              {LEASE_TYPE_LABELS[lease.type_bail] || lease.type_bail}
            </Badge>
            {lease.property && (
              <span className="text-sm font-medium truncate">
                {lease.property.adresse_complete}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {lease.tenant_name && <span>{lease.tenant_name} • </span>}
            <span>Début: {formatDateShort(lease.date_debut)}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <StatusBadge status={statusConfig.status} size="sm">
            {statusConfig.label}
          </StatusBadge>
          <div className="font-semibold text-sm mt-1">
            {formatCurrency(lease.loyer + (lease.charges_forfaitaires || 0))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
});

export default LeaseCard;



