"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { CustomDomain } from "@/lib/white-label/types";

interface DomainManagerProps {
  domains: CustomDomain[];
  organizationId: string;
  onAddDomain: (domain: string) => Promise<CustomDomain>;
  onRemoveDomain: (domainId: string) => Promise<void>;
  onVerifyDomain: (domainId: string) => Promise<{ verified: boolean; error?: string }>;
  onSetPrimary: (domainId: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function DomainManager({
  domains,
  organizationId,
  onAddDomain,
  onRemoveDomain,
  onVerifyDomain,
  onSetPrimary,
  disabled = false,
  className,
}: DomainManagerProps) {
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleAddDomain = useCallback(async () => {
    if (!newDomain.trim()) return;

    // Validation basique du domaine
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(newDomain.trim())) {
      setError("Format de domaine invalide");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onAddDomain(newDomain.trim().toLowerCase());
      setNewDomain("");
      setIsAddingDomain(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    } finally {
      setIsLoading(false);
    }
  }, [newDomain, onAddDomain]);

  const handleVerify = useCallback(
    async (domainId: string) => {
      setVerifyingId(domainId);
      try {
        const result = await onVerifyDomain(domainId);
        if (!result.verified && result.error) {
          setError(result.error);
        }
      } catch (err) {
        setError("Erreur lors de la vérification");
      } finally {
        setVerifyingId(null);
      }
    },
    [onVerifyDomain]
  );

  const handleCopyToken = useCallback((token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }, []);

  const getStatusBadge = (domain: CustomDomain) => {
    if (domain.verified) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Vérifié
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
        <Clock className="w-3 h-3 mr-1" />
        En attente
      </Badge>
    );
  };

  const getSSLBadge = (domain: CustomDomain) => {
    if (!domain.verified) return null;

    switch (domain.ssl_status) {
      case "active":
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            <Shield className="w-3 h-3 mr-1" />
            SSL Actif
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            <Clock className="w-3 h-3 mr-1" />
            SSL en cours
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="border-red-500 text-red-600">
            <XCircle className="w-3 h-3 mr-1" />
            SSL échoué
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Domaines personnalisés
            </CardTitle>
            <CardDescription>
              Configurez vos domaines pour accéder à la plateforme
            </CardDescription>
          </div>

          <Dialog open={isAddingDomain} onOpenChange={setIsAddingDomain}>
            <DialogTrigger asChild>
              <Button disabled={disabled}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un domaine
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un domaine</DialogTitle>
                <DialogDescription>
                  Entrez le domaine que vous souhaitez utiliser pour accéder à la plateforme.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domaine</Label>
                  <Input
                    id="domain"
                    placeholder="app.monentreprise.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                  />
                  <p className="text-xs text-slate-500">
                    Exemple : app.monentreprise.com ou gestion.monagence.fr
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingDomain(false);
                    setError(null);
                    setNewDomain("");
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleAddDomain} disabled={isLoading || !newDomain.trim()}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {domains.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Globe className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-medium text-slate-600 mb-2">Aucun domaine configuré</h3>
            <p className="text-sm text-slate-500 mb-4">
              Ajoutez un domaine personnalisé pour accéder à votre plateforme brandée
            </p>
            <Button variant="outline" onClick={() => setIsAddingDomain(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter mon premier domaine
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {domains.map((domain) => (
                <motion.div
                  key={domain.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "border rounded-xl p-4",
                    domain.is_primary
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          domain.verified
                            ? "bg-green-100 text-green-600"
                            : "bg-amber-100 text-amber-600"
                        )}
                      >
                        <Globe className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-slate-900">
                            {domain.domain}
                          </span>
                          {domain.is_primary && (
                            <Badge variant="outline" className="text-xs">
                              Principal
                            </Badge>
                          )}
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(domain)}
                          {getSSLBadge(domain)}
                        </div>

                        {/* Instructions de vérification */}
                        {!domain.verified && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                            <p className="text-sm font-medium text-slate-700 mb-2">
                              Vérification DNS requise
                            </p>
                            <p className="text-xs text-slate-500 mb-3">
                              Ajoutez un enregistrement TXT à votre DNS avec les valeurs suivantes :
                            </p>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-slate-50 rounded font-mono text-xs">
                                <div>
                                  <span className="text-slate-500">Type:</span>{" "}
                                  <span className="text-slate-900">TXT</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 rounded font-mono text-xs">
                                <div>
                                  <span className="text-slate-500">Nom:</span>{" "}
                                  <span className="text-slate-900">_talok-verify</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 rounded font-mono text-xs">
                                <div className="flex-1 truncate">
                                  <span className="text-slate-500">Valeur:</span>{" "}
                                  <span className="text-slate-900">{domain.verification_token}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToken(domain.verification_token)}
                                  className="h-6 ml-2"
                                >
                                  {copiedToken === domain.verification_token ? (
                                    <Check className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full"
                              onClick={() => handleVerify(domain.id)}
                              disabled={verifyingId === domain.id}
                            >
                              {verifyingId === domain.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                              )}
                              Vérifier maintenant
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {domain.verified && !domain.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSetPrimary(domain.id)}
                        >
                          Définir principal
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onRemoveDomain(domain.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info */}
        <Alert className="mt-6">
          <Globe className="h-4 w-4" />
          <AlertTitle>Configuration DNS</AlertTitle>
          <AlertDescription className="text-sm">
            Après vérification, configurez un enregistrement CNAME pointant vers{" "}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
              app.talok.fr
            </code>{" "}
            pour activer votre domaine.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default DomainManager;
