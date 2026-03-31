"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Loader2,
  Users,
  RefreshCw,
  CalendarOff,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  Eye,
  CalendarClock,
  Trash2,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/helpers/format";
import { KeyHandoverQRGenerator } from "@/components/key-handover/KeyHandoverQRGenerator";
import { LeaseTimeline } from "@/components/owner/leases/LeaseTimeline";
import { resolveTenantDisplay, resolveTenantFullName } from "@/lib/helpers/resolve-tenant-display";
import type { LeaseReadinessState } from "../../_data/lease-readiness";

interface LeaseDetailsSidebarProps {
  leaseId: string;
  lease: any;
  property: any;
  signers: any[];
  payments: any[];
  documents: any[];
  edl: any;
  mainTenant: any;
  readinessState: LeaseReadinessState;
  hasSignedEdl: boolean;
  hasPaidInitial: boolean;
  hasKeysHandedOver: boolean;
  displayLoyer: number;
  displayCharges: number;
  displayDepot: number;
  premierVersement: number;
  canRenew: boolean;
  canTerminate: boolean;
  canCancel: boolean;
  isActivating: boolean;
  isResendingTenant: boolean;
  onActivate: (force: boolean) => void;
  onResendTenantInvite: (signerId: string) => void;
  onShowRenewalWizard: () => void;
  showTerminateDialog: boolean;
  onShowTerminateDialog: (show: boolean) => void;
  isTerminating: boolean;
  onTerminate: () => void;
  showCancelDialog: boolean;
  onShowCancelDialog: (show: boolean) => void;
  isCancelling: boolean;
  onCancel: () => void;
  cancelType: string;
  onCancelTypeChange: (type: string) => void;
  cancelReason: string;
  onCancelReasonChange: (reason: string) => void;
  showDeleteDialog: boolean;
  onShowDeleteDialog: (show: boolean) => void;
  isDeleting: boolean;
  onDelete: () => void;
  onOpenTab: (tab: "contrat" | "edl" | "documents" | "paiements") => void;
}

export function LeaseDetailsSidebar({
  leaseId,
  lease,
  property,
  signers,
  payments,
  edl,
  mainTenant,
  readinessState,
  hasSignedEdl,
  hasPaidInitial,
  hasKeysHandedOver,
  displayLoyer,
  displayCharges,
  displayDepot,
  premierVersement,
  canRenew,
  canTerminate,
  canCancel,
  isActivating,
  isResendingTenant,
  onActivate,
  onResendTenantInvite,
  onShowRenewalWizard,
  showTerminateDialog,
  onShowTerminateDialog,
  isTerminating,
  onTerminate,
  showCancelDialog,
  onShowCancelDialog,
  isCancelling,
  onCancel,
  cancelType,
  onCancelTypeChange,
  cancelReason,
  onCancelReasonChange,
  showDeleteDialog,
  onShowDeleteDialog,
  isDeleting,
  onDelete,
  onOpenTab,
}: LeaseDetailsSidebarProps) {
  return (
    <div className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2 space-y-6">
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-50">
          <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Lecture métier unifiée
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Étape actuelle
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {readinessState.hero.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {readinessState.hero.description}
            </p>
          </div>

          {readinessState.blockingReasons.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                Blocages restants
              </p>
              <div className="mt-2 space-y-1.5">
                {readinessState.blockingReasons.map((reason) => (
                  <p key={reason} className="text-xs text-amber-800">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-50">
          <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Checklist d&apos;activation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-2">
            {readinessState.checklist.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <ChecklistRow status={item.status} label={item.label} />
                {item.actionLabel && item.href ? (
                  <Link
                    href={item.href}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "h-6 px-2 text-[10px]"
                    )}
                  >
                    {item.actionLabel}
                  </Link>
                ) : item.actionLabel && item.tab ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onOpenTab(item.tab!)}
                  >
                    {item.actionLabel}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remise des cles QR */}
      {hasSignedEdl && hasPaidInitial && !hasKeysHandedOver && (
        <div id="key-handover-section">
          <KeyHandoverQRGenerator leaseId={leaseId} />
        </div>
      )}

      {/* Carte Info Rapide */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Détails Clés
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Loyer mensuel</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(displayLoyer + displayCharges)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(displayLoyer)} HC + {formatCurrency(displayCharges)} charges
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
            <div>
              <p className="text-xs text-muted-foreground">Dépôt de garantie</p>
              <p className="text-base font-semibold text-slate-800">{formatCurrency(displayDepot)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">1er versement</p>
              <p className="text-base font-semibold text-emerald-600">{formatCurrency(premierVersement)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-50">
            <p className="text-xs text-muted-foreground mb-2">Locataire</p>
            {mainTenant ? (
              (() => {
                const tenantDisplay = resolveTenantDisplay(mainTenant);
                const initial1 = (tenantDisplay.prenom?.[0] || tenantDisplay.nom?.[0] || "?").toUpperCase();
                const initial2 = (tenantDisplay.prenom ? tenantDisplay.nom?.[0] : tenantDisplay.nom?.[1]) || "";
                const isUnlinked = !tenantDisplay.isLinked && !tenantDisplay.isPlaceholder;
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {initial1}{initial2 ? initial2.toUpperCase() : ""}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {resolveTenantFullName(mainTenant) || "Locataire"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-5">Principal</Badge>
                          {isUnlinked && (
                            <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-300">
                              Invitation envoyée
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isUnlinked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed"
                        disabled={isResendingTenant}
                        onClick={() => onResendTenantInvite(mainTenant.id)}
                      >
                        {isResendingTenant ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Relancer l&apos;invitation
                      </Button>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm italic text-muted-foreground">En attente d&apos;invitation</p>
                <Link
                  href={`/owner/leases/${leaseId}/signers`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full border-dashed")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Inviter un locataire
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chronologie */}
      <LeaseTimeline
        lease={lease}
        signers={(signers || []).map((s: any) => ({
          role: s.role,
          signed_at: s.signed_at,
          profile: s.profile ? { prenom: s.profile.prenom, nom: s.profile.nom } : null,
        }))}
        edl={edl}
        payments={(payments || []).map((p: any) => ({
          created_at: p.created_at,
          statut: p.statut,
          montant: p.montant,
        }))}
      />

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-center gap-2 text-xs text-muted-foreground border-dashed">
            <MoreHorizontal className="h-4 w-4" />
            Plus d&apos;actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {property?.id && (
            <DropdownMenuItem asChild>
              <Link href={`/owner/visits?property_id=${property.id}`} className="cursor-pointer">
                <Eye className="h-4 w-4 mr-2" />
                Visites du bien
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/owner/end-of-lease`} className="cursor-pointer">
              <CalendarClock className="h-4 w-4 mr-2" />
              Processus fin de bail
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canRenew && (
            <DropdownMenuItem onClick={onShowRenewalWizard} className="text-blue-600 focus:text-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Renouveler le bail
            </DropdownMenuItem>
          )}
          {canTerminate && (
            <DropdownMenuItem onClick={() => onShowTerminateDialog(true)} className="text-amber-600 focus:text-amber-700">
              <CalendarOff className="h-4 w-4 mr-2" />
              Résilier le bail
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem onClick={() => onShowCancelDialog(true)} className="text-gray-600 focus:text-gray-700">
              <XCircle className="h-4 w-4 mr-2" />
              Annuler ce bail
            </DropdownMenuItem>
          )}
          {(canRenew || canTerminate || canCancel) && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => onShowDeleteDialog(true)} className="text-red-500 focus:text-red-700 focus:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer ce bail
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <AlertDialog open={showTerminateDialog} onOpenChange={onShowTerminateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600 flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Résilier ce bail ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action mettra fin au bail. Le locataire sera notifié et
              le processus de fin de bail (EDL, restitution dépôt) sera initié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTerminating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onTerminate}
              disabled={isTerminating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isTerminating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Résiliation...
                </>
              ) : (
                "Confirmer la résiliation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog annulation de bail */}
      <AlertDialog open={showCancelDialog} onOpenChange={onShowCancelDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Annuler ce bail ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Cette action annulera le bail. Les documents associés seront archivés
                  et les factures en attente seront annulées. Le locataire sera notifié.
                </p>
                <div className="space-y-2">
                  <label htmlFor="cancel-type" className="text-xs font-medium text-gray-700">
                    Motif d&apos;annulation
                  </label>
                  <select
                    id="cancel-type"
                    value={cancelType}
                    onChange={(e) => onCancelTypeChange(e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="tenant_withdrawal">Rétractation du locataire</option>
                    <option value="owner_withdrawal">Retrait du propriétaire</option>
                    <option value="mutual_agreement">Accord mutuel</option>
                    <option value="never_activated">Jamais activé</option>
                    <option value="error">Erreur de saisie</option>
                    <option value="duplicate">Bail en doublon</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="cancel-reason" className="text-xs font-medium text-gray-700">
                    Commentaire (optionnel)
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => onCancelReasonChange(e.target.value)}
                    placeholder="Précisez le motif si nécessaire..."
                    rows={2}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={onCancel}
              disabled={isCancelling}
              className="bg-gray-600 hover:bg-gray-700"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Annulation...
                </>
              ) : (
                "Confirmer l'annulation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={onShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Supprimer définitivement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action effacera le bail, l&apos;historique des paiements et tous les documents associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChecklistRow({
  status,
  label,
}: {
  status: "complete" | "action_required" | "warning" | "locked";
  label: string;
}) {
  const iconBg =
    status === "complete"
      ? "bg-emerald-100"
      : status === "action_required"
        ? "bg-red-100"
        : status === "locked"
          ? "bg-slate-100"
          : "bg-amber-100";

  const textColor =
    status === "complete"
      ? "text-emerald-700"
      : status === "action_required"
        ? "text-red-700"
        : status === "locked"
          ? "text-slate-500"
          : "text-amber-700";

  return (
    <div className="flex items-center gap-2">
      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {status === "complete" ? (
          <CheckCircle className="h-3 w-3 text-emerald-600" />
        ) : status === "action_required" ? (
          <ShieldAlert className="h-3 w-3 text-red-600" />
        ) : (
          <Clock
            className={`h-3 w-3 ${
              status === "locked" ? "text-slate-400" : "text-amber-600"
            }`}
          />
        )}
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
    </div>
  );
}
