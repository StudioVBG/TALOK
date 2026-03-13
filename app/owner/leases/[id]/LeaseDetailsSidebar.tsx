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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/helpers/format";
import { KeyHandoverQRGenerator } from "@/components/key-handover/KeyHandoverQRGenerator";
import { LeaseTimeline } from "@/components/owner/leases/LeaseTimeline";
import { resolveTenantDisplay, resolveTenantFullName } from "@/lib/helpers/resolve-tenant-display";
import type { LucideIcon } from "lucide-react";

interface NextActionData {
  type: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action?: (() => void) | null;
  actionLabel?: string | null;
  href?: string;
  color: string;
  urgent?: boolean;
}

interface LeaseDetailsSidebarProps {
  leaseId: string;
  lease: any;
  property: any;
  signers: any[];
  payments: any[];
  documents: any[];
  edl: any;
  mainTenant: any;
  nextAction: NextActionData | null;
  hasSignedEdl: boolean;
  hasPaidInitial: boolean;
  hasKeysHandedOver: boolean;
  displayLoyer: number;
  displayCharges: number;
  displayDepot: number;
  premierVersement: number;
  dpeStatus: { status: string; data?: any } | null;
  leaseAnnexes: any[];
  canActivate: boolean;
  canRenew: boolean;
  canTerminate: boolean;
  isActivating: boolean;
  isResendingTenant: boolean;
  onActivate: (force: boolean) => void;
  onResendTenantInvite: (signerId: string) => void;
  onShowSignatureModal: () => void;
  onShowRenewalWizard: () => void;
  showTerminateDialog: boolean;
  onShowTerminateDialog: (show: boolean) => void;
  isTerminating: boolean;
  onTerminate: () => void;
  showDeleteDialog: boolean;
  onShowDeleteDialog: (show: boolean) => void;
  isDeleting: boolean;
  onDelete: () => void;
}

const ACTION_COLOR_MAP: Record<string, { border: string; bg: string; iconBg: string; iconText: string; title: string; desc: string; btn: string; btnHover: string }> = {
  amber:  { border: "border-amber-200",   bg: "bg-amber-50/50",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   title: "text-amber-900",   desc: "text-amber-700",   btn: "bg-amber-600",   btnHover: "hover:bg-amber-700" },
  blue:   { border: "border-blue-200",    bg: "bg-blue-50/50",    iconBg: "bg-blue-100",    iconText: "text-blue-600",    title: "text-blue-900",    desc: "text-blue-700",    btn: "bg-blue-600",    btnHover: "hover:bg-blue-700" },
  indigo: { border: "border-indigo-200",  bg: "bg-indigo-50/50",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  title: "text-indigo-900",  desc: "text-indigo-700",  btn: "bg-indigo-600",  btnHover: "hover:bg-indigo-700" },
  green:  { border: "border-emerald-200", bg: "bg-emerald-50/50", iconBg: "bg-emerald-100", iconText: "text-emerald-600", title: "text-emerald-900", desc: "text-emerald-700", btn: "bg-emerald-600", btnHover: "hover:bg-emerald-700" },
};

export function LeaseDetailsSidebar({
  leaseId,
  lease,
  property,
  signers,
  payments,
  edl,
  mainTenant,
  nextAction,
  hasSignedEdl,
  hasPaidInitial,
  hasKeysHandedOver,
  displayLoyer,
  displayCharges,
  displayDepot,
  premierVersement,
  dpeStatus,
  leaseAnnexes,
  canActivate,
  canRenew,
  canTerminate,
  isActivating,
  isResendingTenant,
  onActivate,
  onResendTenantInvite,
  onShowRenewalWizard,
  showTerminateDialog,
  onShowTerminateDialog,
  isTerminating,
  onTerminate,
  showDeleteDialog,
  onShowDeleteDialog,
  isDeleting,
  onDelete,
}: LeaseDetailsSidebarProps) {
  return (
    <div className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2 space-y-6">
      {/* Banniere action prioritaire */}
      {nextAction && nextAction.actionLabel && (() => {
        const c = ACTION_COLOR_MAP[nextAction.color] || ACTION_COLOR_MAP.indigo;
        const ActionIcon = nextAction.icon;
        return (
          <Card className={`border-2 ${c.border} ${c.bg} overflow-hidden`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full flex-shrink-0 ${c.iconBg}`}>
                  <ActionIcon className={`h-4 w-4 ${c.iconText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${c.title}`}>
                    {nextAction.title}
                  </p>
                  <p className={`text-xs ${c.desc} mt-0.5`}>
                    {nextAction.description}
                  </p>
                  <div className="mt-3">
                    {nextAction.href ? (
                      <Link
                        href={nextAction.href}
                        className={cn(buttonVariants({ size: "sm" }), `w-full gap-2 ${c.btn} ${c.btnHover} text-white`)}
                      >
                        {nextAction.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : nextAction.action ? (
                      <Button size="sm" onClick={nextAction.action} className={`w-full gap-2 ${c.btn} ${c.btnHover} text-white`}>
                        {nextAction.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Checklist d'activation */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-50">
          <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Checklist d&apos;activation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-2">
            <ChecklistRow
              done={["fully_signed", "active", "terminated", "archived"].includes(lease.statut)}
              label="Bail signé par toutes les parties"
            />
            <div className="flex items-center justify-between">
              <ChecklistRow
                done={dpeStatus?.status === "VALID"}
                label={dpeStatus?.status === "VALID" ? "DPE conforme" : `DPE ${dpeStatus?.status === "EXPIRED" ? "expiré" : "manquant"}`}
                variant={dpeStatus?.status === "VALID" ? "success" : "error"}
              />
              {dpeStatus?.status !== "VALID" && (
                <Link
                  href={`/owner/properties/${property.id}/diagnostics`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50")}
                >
                  Régulariser
                </Link>
              )}
            </div>
            <ChecklistRow
              done={leaseAnnexes.some((a: any) => a.type === "attestation_assurance")}
              label={leaseAnnexes.some((a: any) => a.type === "attestation_assurance") ? "Assurance habitation reçue" : "Assurance habitation en attente"}
              variant={leaseAnnexes.some((a: any) => a.type === "attestation_assurance") ? "success" : "pending"}
            />
            <div className="flex items-center justify-between">
              <ChecklistRow
                done={hasSignedEdl}
                label={hasSignedEdl ? "État des lieux réalisé" : "État des lieux requis"}
              />
              {canActivate && !hasSignedEdl && (
                edl ? (
                  <Link
                    href={`/owner/inspections/${edl.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50")}
                  >
                    {["draft", "scheduled", "in_progress"].includes(edl.status) ? "Continuer" : "Voir"}
                  </Link>
                ) : (
                  <Link
                    href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50")}
                  >
                    Créer
                  </Link>
                )
              )}
            </div>
          </div>
          {canActivate && !hasSignedEdl && (
            <div className="pt-2 border-t border-slate-50">
              <AlertDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-slate-400 hover:text-slate-600"
                  disabled={isActivating}
                  asChild
                >
                  <AlertDialogTrigger>
                    {isActivating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Activer sans état des lieux
                  </AlertDialogTrigger>
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">
                      Activer sans état des lieux ?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        L'état des lieux d'entrée est <strong>obligatoire</strong> (loi du 6 juillet 1989, art. 3-2).
                        Sans lui, le logement est présumé en bon état à l'entrée du locataire.
                      </p>
                      <p>
                        En cas de dégradation, vous ne pourrez <strong>pas retenir le dépôt de garantie</strong> sans
                        preuve de l'état initial du logement.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onActivate(true)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Activer quand même
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
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
          {(canRenew || canTerminate) && <DropdownMenuSeparator />}
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

function ChecklistRow({ done, label, variant = "default" }: { done: boolean; label: string; variant?: "default" | "success" | "error" | "pending" }) {
  const iconBg = done
    ? "bg-emerald-100"
    : variant === "error"
    ? "bg-red-100"
    : variant === "pending"
    ? "bg-slate-100"
    : "bg-amber-100";

  const textColor = done
    ? "text-emerald-700"
    : variant === "error"
    ? "text-red-700"
    : variant === "pending"
    ? "text-slate-500"
    : "text-amber-700";

  return (
    <div className="flex items-center gap-2">
      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {done ? (
          <CheckCircle className="h-3 w-3 text-emerald-600" />
        ) : variant === "error" ? (
          <ShieldAlert className="h-3 w-3 text-red-600" />
        ) : (
          <Clock className={`h-3 w-3 ${variant === "pending" ? "text-slate-400" : "text-amber-600"}`} />
        )}
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
    </div>
  );
}
