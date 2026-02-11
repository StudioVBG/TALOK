"use client";

import { useOfflineEDL } from "@/lib/edl-offline";
import { WifiOff, RefreshCw, CloudOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bannière de synchronisation EDL hors-ligne.
 * Affiche l'état de la connexion et permet de déclencher la sync manuellement.
 *
 * À placer dans les pages d'inspection EDL (mobile-first).
 */
export function OfflineSyncBanner() {
  const {
    isOffline,
    isSyncing,
    syncProgress,
    pendingCount,
    triggerSync,
  } = useOfflineEDL();

  // Rien à afficher si en ligne et pas de données en attente
  if (!isOffline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-16 left-0 right-0 z-40 mx-4 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all",
        isOffline
          ? "border-amber-300 bg-amber-50/95 dark:bg-amber-950/95"
          : isSyncing
            ? "border-blue-300 bg-blue-50/95 dark:bg-blue-950/95"
            : "border-green-300 bg-green-50/95 dark:bg-green-950/95"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isOffline ? (
            <WifiOff className="h-5 w-5 text-amber-600 flex-shrink-0" />
          ) : isSyncing ? (
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          )}

          <div className="min-w-0">
            {isOffline ? (
              <>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Mode hors-ligne
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                  {pendingCount > 0
                    ? `${pendingCount} modification(s) en attente de synchronisation`
                    : "Les modifications seront sauvegardées localement"}
                </p>
              </>
            ) : isSyncing ? (
              <>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Synchronisation en cours...
                </p>
                {syncProgress && (
                  <div className="mt-1">
                    <div className="h-1.5 w-full bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${syncProgress.total > 0 ? (syncProgress.completed / syncProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {syncProgress.completed}/{syncProgress.total}
                      {syncProgress.current ? ` — ${syncProgress.current}` : ""}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {pendingCount} modification(s) en attente
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Appuyez sur synchroniser pour envoyer
                </p>
              </>
            )}
          </div>
        </div>

        {!isOffline && !isSyncing && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={triggerSync}
            className="flex-shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
        )}

        {isOffline && (
          <CloudOff className="h-5 w-5 text-amber-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
