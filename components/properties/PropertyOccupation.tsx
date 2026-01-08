"use client";

/**
 * PropertyOccupation - Section occupation/bail
 * Architecture SOTA 2025 - Composant de présentation pur
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Users, Calendar, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PropertyLease, PropertyTenant, PropertyOccupationProps } from "./types";

// ============================================
// HELPERS
// ============================================

const LEASE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { 
    label: "Brouillon", 
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400" 
  },
  pending_signature: { 
    label: "Signature en cours", 
    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" 
  },
  active: { 
    label: "Actif", 
    color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" 
  },
  terminated: { 
    label: "Résilié", 
    color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" 
  },
  expired: { 
    label: "Expiré", 
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400" 
  },
};

// ============================================
// SOUS-COMPOSANTS
// ============================================

function VacantState({ 
  propertyId, 
  createLeaseHref, 
  allowActions 
}: { 
  propertyId: string; 
  createLeaseHref?: string;
  allowActions?: boolean;
}) {
  const href = createLeaseHref || `/owner/leases/new?propertyId=${propertyId}`;
  
  return (
    <div className="text-center space-y-4">
      <Badge variant="outline" className="text-muted-foreground">Vacant</Badge>
      <p className="text-sm text-muted-foreground">Aucun locataire actuellement.</p>
      {allowActions && (
        <Button asChild className="w-full" variant="default">
          <Link href={href}>
            <FileText className="mr-2 h-4 w-4" />
            Créer un bail
          </Link>
        </Button>
      )}
    </div>
  );
}

function LeaseInfo({ 
  lease, 
  viewLeaseHref,
  allowActions 
}: { 
  lease: PropertyLease;
  viewLeaseHref?: (leaseId: string) => string;
  allowActions?: boolean;
}) {
  const statusConfig = LEASE_STATUS_CONFIG[lease.statut] || LEASE_STATUS_CONFIG.draft;
  const isActive = lease.statut === "active";
  const isPending = lease.statut === "pending_signature";
  const isDraft = lease.statut === "draft";
  
  const leaseHref = viewLeaseHref 
    ? viewLeaseHref(lease.id) 
    : `/owner/leases/${lease.id}`;

  return (
    <div className="space-y-4">
      {/* Status et lien */}
      <div className="flex items-center justify-between">
        <Badge className={statusConfig.color}>
          {statusConfig.label}
        </Badge>
        {allowActions && (
          <Link 
            href={leaseHref}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Voir le bail
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      
      {/* Locataire(s) */}
      {isActive && lease.tenants && lease.tenants.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Locataire(s)
          </p>
          <p className="font-medium text-foreground mt-1">
            {lease.tenants.map((t) => `${t.prenom} ${t.nom}`).join(", ")}
          </p>
        </div>
      )}
      
      {/* Dates du bail */}
      {isActive && lease.date_debut && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Période
          </p>
          <p className="text-sm text-foreground mt-1">
            Depuis le {format(new Date(lease.date_debut), "dd MMMM yyyy", { locale: fr })}
            {lease.date_fin && (
              <> jusqu'au {format(new Date(lease.date_fin), "dd MMMM yyyy", { locale: fr })}</>
            )}
          </p>
        </div>
      )}
      
      {/* En attente de signature */}
      {isPending && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            En attente de signature des parties
          </p>
          {allowActions && (
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href={`${leaseHref}?tab=preview`}>
                Aperçu du bail
              </Link>
            </Button>
          )}
        </div>
      )}
      
      {/* Brouillon */}
      {isDraft && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Bail en cours de création
          </p>
          {allowActions && (
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href={leaseHref}>
                Continuer la création
              </Link>
            </Button>
          )}
        </div>
      )}
      
      {/* Loyer */}
      {lease.loyer && (
        <div className="pt-2 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Loyer</span>
            <span className="font-semibold text-foreground">
              {lease.loyer.toLocaleString("fr-FR")} €/mois
            </span>
          </div>
          {lease.charges && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Charges</span>
              <span className="text-foreground">
                {lease.charges.toLocaleString("fr-FR")} €/mois
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyOccupation({
  propertyId,
  lease,
  tenants,
  className,
  allowActions = true,
  createLeaseHref,
  viewLeaseHref,
}: PropertyOccupationProps) {
  const hasLease = lease && ["draft", "pending_signature", "active"].includes(lease.statut);

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground">Occupation</CardTitle>
      </CardHeader>
      <CardContent>
        {hasLease ? (
          <LeaseInfo 
            lease={lease} 
            viewLeaseHref={viewLeaseHref}
            allowActions={allowActions}
          />
        ) : (
          <VacantState 
            propertyId={propertyId}
            createLeaseHref={createLeaseHref}
            allowActions={allowActions}
          />
        )}
      </CardContent>
    </Card>
  );
}

