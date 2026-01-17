"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Ban,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserX,
  UserCheck,
  Mail,
  MessageSquare,
  Download,
  Trash2,
  History,
  Eye,
  Lock,
  Unlock,
  FileWarning,
  ShieldAlert,
  ShieldCheck,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";

export type AccountStatus = "active" | "suspended" | "under_review" | "restricted" | "banned";
export type ModerationActionType = "warn" | "restrict" | "suspend" | "unsuspend" | "ban" | "unban" | "verify" | "note";

export interface AccountFlag {
  id: string;
  type: "spam" | "fraud" | "complaint" | "inactivity" | "payment_issue" | "document_issue";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface ModerationAction {
  id: string;
  type: ModerationActionType;
  reason: string;
  performedBy: string;
  performedAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface AdminNote {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface OwnerModerationPanelProps {
  ownerId: string;
  ownerName: string;
  accountStatus: AccountStatus;
  flags: AccountFlag[];
  history: ModerationAction[];
  notes: AdminNote[];
  lastLogin?: string;
  onAction?: (action: ModerationActionType, reason: string) => Promise<void>;
  onAddNote?: (note: string) => Promise<void>;
  onExportData?: () => Promise<void>;
  className?: string;
}

const statusConfig: Record<AccountStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  active: {
    label: "Actif",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: CheckCircle,
  },
  suspended: {
    label: "Suspendu",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: Clock,
  },
  under_review: {
    label: "En vérification",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: Eye,
  },
  restricted: {
    label: "Restreint",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    icon: Lock,
  },
  banned: {
    label: "Banni",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: Ban,
  },
};

const flagSeverityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-amber-100 text-amber-600",
  critical: "bg-red-100 text-red-600",
};

const actionTypeLabels: Record<ModerationActionType, string> = {
  warn: "Avertissement",
  restrict: "Restriction",
  suspend: "Suspension",
  unsuspend: "Réactivation",
  ban: "Bannissement",
  unban: "Débannissement",
  verify: "Vérification",
  note: "Note ajoutée",
};

function ActionDialog({
  open,
  onOpenChange,
  action,
  ownerName,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ModerationActionType | null;
  ownerName: string;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = React.useState("");

  const getActionDetails = () => {
    switch (action) {
      case "suspend":
        return {
          title: "Suspendre le compte",
          description: `Êtes-vous sûr de vouloir suspendre le compte de ${ownerName} ? L'utilisateur ne pourra plus se connecter.`,
          variant: "destructive" as const,
          confirmLabel: "Suspendre",
        };
      case "ban":
        return {
          title: "Bannir le compte",
          description: `ATTENTION: Cette action est définitive. ${ownerName} ne pourra plus jamais accéder à la plateforme.`,
          variant: "destructive" as const,
          confirmLabel: "Bannir définitivement",
        };
      case "unsuspend":
        return {
          title: "Réactiver le compte",
          description: `Réactiver le compte de ${ownerName} ? L'utilisateur pourra à nouveau se connecter.`,
          variant: "default" as const,
          confirmLabel: "Réactiver",
        };
      case "warn":
        return {
          title: "Envoyer un avertissement",
          description: `Un email d'avertissement sera envoyé à ${ownerName}.`,
          variant: "default" as const,
          confirmLabel: "Envoyer",
        };
      case "restrict":
        return {
          title: "Restreindre le compte",
          description: `Limiter certaines fonctionnalités pour ${ownerName}.`,
          variant: "secondary" as const,
          confirmLabel: "Appliquer restrictions",
        };
      default:
        return {
          title: "Action",
          description: "",
          variant: "default" as const,
          confirmLabel: "Confirmer",
        };
    }
  };

  const details = getActionDetails();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={action === "ban" || action === "suspend" ? "text-red-600" : ""}>
            {details.title}
          </DialogTitle>
          <DialogDescription>{details.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Raison (obligatoire)</Label>
            <Textarea
              id="reason"
              placeholder="Expliquez la raison de cette action..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            variant={details.variant}
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? "En cours..." : details.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
  isLoading: boolean;
}) {
  const [note, setNote] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une note interne</DialogTitle>
          <DialogDescription>
            Cette note sera visible uniquement par les administrateurs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            placeholder="Écrivez votre note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(note)} disabled={!note.trim() || isLoading}>
            {isLoading ? "Enregistrement..." : "Ajouter la note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OwnerModerationPanel({
  ownerId,
  ownerName,
  accountStatus,
  flags,
  history,
  notes,
  lastLogin,
  onAction,
  onAddNote,
  onExportData,
  className,
}: OwnerModerationPanelProps) {
  const { toast } = useToast();
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = React.useState(false);
  const [currentAction, setCurrentAction] = React.useState<ModerationActionType | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  const status = statusConfig[accountStatus];
  const StatusIcon = status.icon;
  const unresolvedFlags = flags.filter(f => !f.resolved);

  const handleAction = (action: ModerationActionType) => {
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async (reason: string) => {
    if (!currentAction || !onAction) return;
    
    setIsLoading(true);
    try {
      await onAction(currentAction, reason);
      toast({
        title: "Action effectuée",
        description: `${actionTypeLabels[currentAction]} appliqué avec succès.`,
      });
      setActionDialogOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (note: string) => {
    if (!onAddNote) return;
    
    setIsLoading(true);
    try {
      await onAddNote(note);
      toast({
        title: "Note ajoutée",
        description: "La note a été enregistrée.",
      });
      setNoteDialogOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className={cn("border-0 bg-card/50 backdrop-blur-sm", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <Shield className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Modération</CardTitle>
                <CardDescription>Gestion du compte et actions admin</CardDescription>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setNoteDialogOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Ajouter une note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
                  <History className="mr-2 h-4 w-4" />
                  {showHistory ? "Masquer" : "Voir"} l'historique
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Exporter données (RGPD)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Statut du compte */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", status.bgColor)}>
                <StatusIcon className={cn("h-5 w-5", status.color)} />
              </div>
              <div>
                <p className="font-medium">Statut du compte</p>
                <p className="text-sm text-muted-foreground">
                  {lastLogin ? `Dernière connexion: ${formatDateShort(lastLogin)}` : "Jamais connecté"}
                </p>
              </div>
            </div>
            <Badge className={cn(status.bgColor, status.color, "border-0")}>
              {status.label}
            </Badge>
          </div>

          {/* Alertes / Flags */}
          {unresolvedFlags.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Alertes actives ({unresolvedFlags.length})</span>
              </div>
              <div className="space-y-2">
                {unresolvedFlags.map((flag) => (
                  <motion.div
                    key={flag.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-amber-600" />
                      <span className="text-sm">{flag.description}</span>
                    </div>
                    <Badge className={flagSeverityColors[flag.severity]}>
                      {flag.severity}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Actions principales */}
          <div className="grid grid-cols-2 gap-3">
            {accountStatus === "active" && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleAction("warn")}
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Avertir
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleAction("restrict")}
                >
                  <Lock className="h-4 w-4 text-orange-500" />
                  Restreindre
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleAction("suspend")}
                >
                  <UserX className="h-4 w-4" />
                  Suspendre
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => handleAction("ban")}
                >
                  <Ban className="h-4 w-4" />
                  Bannir
                </Button>
              </>
            )}
            
            {accountStatus === "suspended" && (
              <>
                <Button
                  variant="default"
                  className="gap-2 col-span-2"
                  onClick={() => handleAction("unsuspend")}
                >
                  <UserCheck className="h-4 w-4" />
                  Réactiver le compte
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2 col-span-2"
                  onClick={() => handleAction("ban")}
                >
                  <Ban className="h-4 w-4" />
                  Bannir définitivement
                </Button>
              </>
            )}
            
            {accountStatus === "banned" && (
              <div className="col-span-2 text-center py-4 text-muted-foreground">
                <Ban className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-sm">Ce compte est définitivement banni.</p>
              </div>
            )}
          </div>

          {/* Notes internes */}
          {notes.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Notes internes ({notes.length})</span>
                <Button variant="ghost" size="sm" onClick={() => setNoteDialogOpen(true)}>
                  Ajouter
                </Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    <p className="line-clamp-2">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {note.author} • {formatDateShort(note.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique */}
          <AnimatePresence>
            {showHistory && history.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-4 border-t overflow-hidden"
              >
                <span className="text-sm font-medium">Historique des actions</span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 text-sm"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{actionTypeLabels[action.type]}</p>
                        <p className="text-muted-foreground line-clamp-1">{action.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {action.performedBy} • {formatDateShort(action.performedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        action={currentAction}
        ownerName={ownerName}
        onConfirm={confirmAction}
        isLoading={isLoading}
      />
      
      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onConfirm={handleAddNote}
        isLoading={isLoading}
      />
    </>
  );
}

