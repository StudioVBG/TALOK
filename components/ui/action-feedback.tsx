"use client";

import * as React from "react";
import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type FeedbackStatus = "idle" | "loading" | "success" | "error";

interface UseActionFeedbackOptions {
  /**
   * Durée avant de revenir à l'état idle (ms)
   * @default 2000
   */
  resetDelay?: number;
  /**
   * Afficher un toast en plus du feedback visuel
   * @default false
   */
  showToast?: boolean;
  /**
   * Messages personnalisés pour les toasts
   */
  messages?: {
    loading?: string;
    success?: string;
    error?: string;
  };
}

/**
 * Hook pour gérer le feedback des actions
 *
 * Usage:
 * ```tsx
 * const { status, execute } = useActionFeedback({
 *   showToast: true,
 *   messages: { success: "Copié !" }
 * });
 *
 * const handleCopy = () => execute(async () => {
 *   await navigator.clipboard.writeText(text);
 * });
 * ```
 */
export function useActionFeedback(options: UseActionFeedbackOptions = {}) {
  const { resetDelay = 2000, showToast = false, messages = {} } = options;
  const { toast } = useToast();
  const [status, setStatus] = React.useState<FeedbackStatus>("idle");
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const reset = React.useCallback(() => {
    setStatus("idle");
  }, []);

  const execute = React.useCallback(
    async (action: () => Promise<void> | void) => {
      // Clear any pending reset
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setStatus("loading");

      try {
        await action();
        setStatus("success");

        if (showToast && messages.success) {
          toast({
            title: messages.success,
            duration: 2000,
          });
        }
      } catch (error) {
        setStatus("error");

        if (showToast) {
          toast({
            title: messages.error || "Une erreur est survenue",
            variant: "destructive",
            duration: 3000,
          });
        }
      } finally {
        // Auto-reset after delay
        timeoutRef.current = setTimeout(() => {
          setStatus("idle");
        }, resetDelay);
      }
    },
    [resetDelay, showToast, messages, toast]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    isIdle: status === "idle",
    execute,
    reset,
  };
}

/**
 * Composant d'icône avec feedback visuel
 */
interface FeedbackIconProps {
  status: FeedbackStatus;
  idleIcon: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FeedbackIcon({
  status,
  idleIcon,
  className,
  size = "md",
}: FeedbackIconProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const iconClass = cn(sizeClasses[size], className);

  switch (status) {
    case "loading":
      return <Loader2 className={cn(iconClass, "animate-spin")} />;
    case "success":
      return <Check className={cn(iconClass, "text-green-500")} />;
    case "error":
      return <X className={cn(iconClass, "text-red-500")} />;
    default:
      return <>{idleIcon}</>;
  }
}

/**
 * Bouton Copier avec feedback intégré
 */
interface CopyButtonProps {
  text: string;
  className?: string;
  successMessage?: string;
}

export function CopyButton({
  text,
  className,
  successMessage = "Copié !",
}: CopyButtonProps) {
  const { status, execute } = useActionFeedback({
    showToast: true,
    messages: { success: successMessage },
  });

  const handleCopy = () =>
    execute(async () => {
      await navigator.clipboard.writeText(text);
    });

  return (
    <button
      onClick={handleCopy}
      disabled={status === "loading"}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2",
        "text-muted-foreground hover:text-foreground hover:bg-muted",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      aria-label={status === "success" ? "Copié" : "Copier"}
    >
      <FeedbackIcon status={status} idleIcon={<Copy className="h-4 w-4" />} />
    </button>
  );
}

/**
 * Bouton Télécharger avec feedback intégré
 */
interface DownloadButtonProps {
  url: string;
  filename?: string;
  className?: string;
  children?: React.ReactNode;
}

export function DownloadButton({
  url,
  filename,
  className,
  children,
}: DownloadButtonProps) {
  const { status, execute } = useActionFeedback({
    showToast: true,
    messages: {
      success: "Téléchargement lancé",
      error: "Erreur de téléchargement",
    },
  });

  const handleDownload = () =>
    execute(async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    });

  return (
    <button
      onClick={handleDownload}
      disabled={status === "loading"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2",
        "text-sm font-medium",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      aria-label={status === "loading" ? "Téléchargement en cours" : "Télécharger"}
    >
      <FeedbackIcon
        status={status}
        idleIcon={<Download className="h-4 w-4" />}
      />
      {children}
    </button>
  );
}

/**
 * Wrapper pour ajouter du feedback à n'importe quelle action
 */
interface ActionFeedbackWrapperProps {
  children: (props: {
    status: FeedbackStatus;
    execute: (action: () => Promise<void> | void) => Promise<void>;
    isLoading: boolean;
  }) => React.ReactNode;
  options?: UseActionFeedbackOptions;
}

export function ActionFeedbackWrapper({
  children,
  options,
}: ActionFeedbackWrapperProps) {
  const feedbackProps = useActionFeedback(options);
  return <>{children(feedbackProps)}</>;
}
