"use client";

import { LogOut } from "lucide-react";
import { useSignOut } from "@/lib/hooks/use-sign-out";

type Variant = "sidebar" | "mobile-icon";

interface SyndicSignOutButtonProps {
  variant?: Variant;
}

export function SyndicSignOutButton({ variant = "sidebar" }: SyndicSignOutButtonProps) {
  const { signOut, isLoading } = useSignOut({ redirectTo: "/auth/signin" });

  if (variant === "mobile-icon") {
    return (
      <button
        type="button"
        onClick={() => signOut()}
        disabled={isLoading}
        aria-label={isLoading ? "Déconnexion en cours" : "Déconnexion"}
        className="p-2 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
      >
        <LogOut className="w-5 h-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signOut()}
      disabled={isLoading}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 transition-colors disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span>{isLoading ? "Déconnexion..." : "Déconnexion"}</span>
    </button>
  );
}
