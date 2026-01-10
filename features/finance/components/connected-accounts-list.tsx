"use client";

/**
 * ConnectedAccountsList - Liste des comptes bancaires connectés
 * SOTA 2026: Feature bank_reconciliation requiert Confort+
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { BankConnectButton } from "./bank-connect-button";
import { BankConnection } from "../types";
import { bankConnectService } from "../services/bank-connect.service";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanGate } from "@/components/subscription";

export function ConnectedAccountsList() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await bankConnectService.getConnections();
      setConnections(data);
    } catch (error) {
      console.error("Failed to load connections", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment déconnecter cette banque ?")) return;
    try {
      await bankConnectService.deleteConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  if (loading) {
    return <ConnectionsSkeleton />;
  }

  if (connections.length === 0) {
    return (
      <PlanGate feature="bank_reconciliation" mode="blur">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ExternalLink className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucune banque connectée</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Connectez votre compte bancaire pour automatiser le rapprochement des loyers.
            C'est 100% sécurisé et en lecture seule.
          </p>
          <BankConnectButton />
        </CardContent>
      </Card>
      </PlanGate>
    );
  }

  return (
    <PlanGate feature="bank_reconciliation" mode="blur">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Comptes connectés</h3>
        <BankConnectButton variant="outline" size="sm" label="Ajouter une autre banque" />
      </div>

      <div className="grid gap-4">
        {connections.map((connection) => (
          <Card key={connection.id} className="overflow-hidden">
            <div className="p-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-2 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                  {connection.institution_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={connection.institution_logo} 
                      alt={connection.institution_name} 
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {connection.institution_name.charAt(0)}
                    </span>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{connection.institution_name}</h4>
                    <StatusBadge status={connection.status} />
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Connecté le {new Date(connection.created_at).toLocaleDateString("fr-FR")}</p>
                    {connection.last_synced_at && (
                      <p className="flex items-center gap-1 text-xs">
                        <RefreshCw className="w-3 h-3" />
                        Synchro {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true, locale: fr })}
                      </p>
                    )}
                  </div>

                  {/* Liste des sous-comptes */}
                  {connection.accounts && connection.accounts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {connection.accounts.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between text-sm p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-100 dark:border-zinc-800">
                          <span className="font-medium">{acc.name || "Compte Courant"}</span>
                          <span className="font-mono text-muted-foreground text-xs">{acc.iban || "****"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(connection.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
    </PlanGate>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "linked":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <CheckCircle2 className="w-3 h-3" /> Actif
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" /> Erreur
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="secondary" className="gap-1">
          <RefreshCw className="w-3 h-3" /> Expiré
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function ConnectionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      {[1, 2].map((i) => (
        <Card key={i} className="p-6">
          <div className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

