"use client";

import { useSignOut } from "@/lib/hooks/use-sign-out";

export function GuarantorSignOutButton() {
  const { signOut, isLoading } = useSignOut({
    redirectTo: "/auth/signin",
  });

  return (
    <button
      onClick={() => signOut()}
      disabled={isLoading}
      className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      {isLoading ? "Déconnexion..." : "Déconnexion"}
    </button>
  );
}
