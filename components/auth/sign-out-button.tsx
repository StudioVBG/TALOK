"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/lib/hooks/use-sign-out";

type Variant = "sidebar" | "mobile-icon" | "mobile-tile";

interface SignOutButtonProps {
  variant?: Variant;
  redirectTo?: string;
  className?: string;
  onAfterClick?: () => void;
}

/**
 * Bouton de déconnexion partagé — utilise le hook SOTA useSignOut
 * (nettoyage cache, protection double-clic, redirection forcée).
 */
export function SignOutButton({
  variant = "sidebar",
  redirectTo = "/auth/signin",
  className,
  onAfterClick,
}: SignOutButtonProps) {
  const { signOut, isLoading } = useSignOut({ redirectTo });

  const handleClick = () => {
    signOut();
    onAfterClick?.();
  };

  if (variant === "mobile-icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-label={isLoading ? "Déconnexion en cours" : "Déconnexion"}
        className={cn(
          "p-2 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50",
          className,
        )}
      >
        <LogOut className="w-5 h-5" aria-hidden="true" />
      </button>
    );
  }

  if (variant === "mobile-tile") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-h-[68px] transition-colors text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50",
          className,
        )}
      >
        <LogOut className="w-5 h-5" aria-hidden="true" />
        <span className="text-[10px] font-medium text-center leading-tight">
          {isLoading ? "Déconnexion..." : "Déconnexion"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 transition-colors disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span>{isLoading ? "Déconnexion..." : "Déconnexion"}</span>
    </button>
  );
}
