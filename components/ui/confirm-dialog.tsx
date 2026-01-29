"use client";

import { ReactNode, useState, useCallback } from "react";
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
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2, AlertTriangle, Trash2, LogOut, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/use-haptic";

type ConfirmVariant = "danger" | "warning" | "info" | "success";

// Haptic feedback style per confirm variant
const HAPTIC_STYLE_MAP: Record<ConfirmVariant, "error" | "warning" | "medium" | "success"> = {
  danger: "error",
  warning: "warning",
  info: "medium",
  success: "success",
};

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}

const variantConfig: Record<ConfirmVariant, {
  icon: typeof AlertTriangle;
  iconClass: string;
  buttonVariant: ButtonProps["variant"];
}> = {
  danger: {
    icon: Trash2,
    iconClass: "text-destructive",
    buttonVariant: "destructive",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-yellow-500",
    buttonVariant: "default",
  },
  info: {
    icon: Send,
    iconClass: "text-blue-500",
    buttonVariant: "default",
  },
  success: {
    icon: Check,
    iconClass: "text-green-500",
    buttonVariant: "default",
  },
};

/**
 * Dialogue de confirmation réutilisable
 * 
 * @example
 * <ConfirmDialog
 *   trigger={<Button variant="destructive">Supprimer</Button>}
 *   title="Supprimer ce bien ?"
 *   description="Cette action est irréversible. Toutes les données associées seront perdues."
 *   variant="danger"
 *   onConfirm={handleDelete}
 * />
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "warning",
  onConfirm,
  onCancel,
  disabled = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;
  const haptic = useHaptic();

  const handleConfirm = useCallback(async () => {
    // Trigger haptic feedback on confirm action
    haptic(HAPTIC_STYLE_MAP[variant]);
    setIsLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      console.error("Erreur lors de la confirmation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, haptic, variant]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
              variant === "danger" && "bg-destructive/10",
              variant === "warning" && "bg-yellow-500/10",
              variant === "info" && "bg-blue-500/10",
              variant === "success" && "bg-green-500/10"
            )}>
              <Icon className={cn("h-5 w-5", config.iconClass)} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="mt-2">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              variant === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook pour utiliser le dialogue de confirmation de manière programmatique
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    variant: ConfirmVariant;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    variant: "warning",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (options: {
      title: string;
      description?: string;
      variant?: ConfirmVariant;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          title: options.title,
          description: options.description,
          variant: options.variant || "warning",
          onConfirm: () => {
            resolve(true);
            setDialogState((prev) => ({ ...prev, isOpen: false }));
          },
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialogComponent = useCallback(
    () => (
      <AlertDialog open={dialogState.isOpen} onOpenChange={(open) => !open && cancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogState.title}</AlertDialogTitle>
            {dialogState.description && (
              <AlertDialogDescription>{dialogState.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancel}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={dialogState.onConfirm}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
    [dialogState, cancel]
  );

  return { confirm, ConfirmDialogComponent };
}

// Variantes pré-configurées

export function DeleteConfirmDialog({
  trigger,
  itemName,
  onConfirm,
}: {
  trigger: ReactNode;
  itemName: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      trigger={trigger}
      title={`Supprimer ${itemName} ?`}
      description="Cette action est irréversible. Toutes les données associées seront définitivement supprimées."
      confirmLabel="Supprimer"
      variant="danger"
      onConfirm={onConfirm}
    />
  );
}

export function LogoutConfirmDialog({
  trigger,
  onConfirm,
}: {
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      trigger={trigger}
      title="Se déconnecter ?"
      description="Vous allez être déconnecté de votre compte."
      confirmLabel="Se déconnecter"
      variant="warning"
      onConfirm={onConfirm}
    />
  );
}

export function SendConfirmDialog({
  trigger,
  title,
  description,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      trigger={trigger}
      title={title}
      description={description}
      confirmLabel="Envoyer"
      variant="info"
      onConfirm={onConfirm}
    />
  );
}

export default ConfirmDialog;

