"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PenLine, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PendingSignature {
  id: string;
  lease_id: string;
  created_at: string;
  lease: {
    id: string;
    type_bail: string;
    loyer: number;
    date_debut: string;
  };
  property: {
    id: string;
    adresse: string;
  };
}

interface SignatureAlertBannerProps {
  className?: string;
  dismissible?: boolean;
}

export function SignatureAlertBanner({ className, dismissible = true }: SignatureAlertBannerProps) {
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const fetchPendingSignatures = async () => {
      try {
        const response = await apiClient.get<{ count: number; signatures: PendingSignature[] }>(
          "/owner/pending-signatures"
        );
        setSignatures(response.signatures || []);
      } catch (error) {
        console.error("[SignatureAlertBanner] Error fetching signatures:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingSignatures();
  }, []);

  // Ne pas afficher si pas de signatures ou si fermé
  if (isLoading || signatures.length === 0 || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Optionnel: sauvegarder dans localStorage pour ne pas réafficher pendant la session
    sessionStorage.setItem("signature-alert-dismissed", "true");
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border",
      "bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50",
      "border-orange-200 shadow-lg shadow-orange-100/50",
      "animate-in fade-in slide-in-from-top-4 duration-700",
      className
    )}>
      {/* Effet de brillance animé */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
      
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {/* Icône avec animation */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-400 rounded-xl blur-lg opacity-30 animate-pulse" />
              <div className="relative p-3 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl shadow-lg">
                <PenLine className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <h3 className="font-bold text-orange-900 text-lg">
                {signatures.length === 1 
                  ? "Un bail attend votre signature"
                  : `${signatures.length} baux attendent votre signature`}
              </h3>
            </div>
            
            <p className="text-sm text-orange-700 mb-4">
              Finalisez vos contrats en les signant pour les activer.
            </p>

            {/* Liste des baux à signer */}
            <div className="space-y-2">
              {signatures.slice(0, 3).map((sig) => (
                <Link
                  key={sig.id}
                  href={`/owner/leases/${sig.lease_id}`}
                  className="group flex items-center justify-between p-3 bg-white/80 backdrop-blur rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                      <PenLine className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {sig.property.adresse || "Adresse non renseignée"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sig.lease.loyer ? `${sig.lease.loyer.toLocaleString('fr-FR')} €/mois` : "Loyer non renseigné"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                      À signer
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
              
              {signatures.length > 3 && (
                <Link
                  href="/owner/leases?filter=pending_signature"
                  className="block text-center py-2 text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Voir les {signatures.length - 3} autre(s) →
                </Link>
              )}
            </div>
          </div>

          {/* Bouton fermer */}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-orange-100 transition-colors"
              aria-label="Fermer l'alerte"
            >
              <X className="h-5 w-5 text-orange-400 hover:text-orange-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

