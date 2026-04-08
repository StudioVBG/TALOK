"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Globe,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DomainVerifierProps {
  domain: string | null;
  subdomain: string | null;
  domainVerified: boolean;
  onDomainChange: (domain: string) => Promise<void>;
  onVerify: () => Promise<{ verified: boolean; error?: string; instructions?: any }>;
}

export function DomainVerifier({
  domain,
  subdomain,
  domainVerified,
  onDomainChange,
  onVerify,
}: DomainVerifierProps) {
  const { toast } = useToast();
  const [newDomain, setNewDomain] = useState(domain || "");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    error?: string;
    instructions?: { type: string; host: string; value: string; ttl: number };
  } | null>(null);

  const handleSaveDomain = async () => {
    if (!newDomain.trim()) return;
    setIsSaving(true);
    try {
      await onDomainChange(newDomain.trim().toLowerCase());
      toast({ title: "Domaine enregistre", description: "Configurez votre DNS puis verifiez." });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le domaine.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await onVerify();
      setVerificationResult(result);
      if (result.verified) {
        toast({ title: "Domaine verifie", description: "Votre domaine personnalise est actif." });
      }
    } catch {
      toast({ title: "Erreur", description: "Echec de la verification.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copie", description: "Valeur copiee dans le presse-papiers." });
  };

  return (
    <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Domaine personnalise
        </CardTitle>
        <CardDescription>
          Utilisez votre propre domaine pour acceder a votre espace agence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current status */}
        {domain && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{domain}</p>
              <p className="text-xs text-muted-foreground">
                {subdomain ? `Sous-domaine : ${subdomain}.talok.fr` : "Domaine personnalise"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                domainVerified
                  ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                  : "border-amber-500 text-amber-600 bg-amber-50"
              )}
            >
              {domainVerified ? (
                <><CheckCircle className="w-3 h-3 mr-1" /> Verifie</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" /> Non verifie</>
              )}
            </Badge>
          </div>
        )}

        {/* Domain input */}
        <div className="space-y-2">
          <Label htmlFor="custom_domain">Nom de domaine</Label>
          <div className="flex gap-2">
            <Input
              id="custom_domain"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="app.monagence.fr"
            />
            <Button onClick={handleSaveDomain} disabled={isSaving || !newDomain.trim()}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Entrez le domaine ou sous-domaine que vous souhaitez utiliser
          </p>
        </div>

        {/* DNS Instructions */}
        {domain && !domainVerified && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Configuration DNS requise
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Ajoutez un enregistrement CNAME chez votre registrar :
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 font-mono text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Type :</span> CNAME
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="text-muted-foreground">Host :</span> {domain}
                </div>
                <button
                  onClick={() => copyToClipboard(domain)}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="text-muted-foreground">Value :</span> app.talok.fr
                </div>
                <button
                  onClick={() => copyToClipboard("app.talok.fr")}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verification result */}
        {verificationResult && !verificationResult.verified && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              {verificationResult.error || "La verification a echoue."}
            </p>
          </div>
        )}

        {/* Verify button */}
        {domain && !domainVerified && (
          <Button variant="outline" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isVerifying ? "Verification en cours..." : "Verifier le DNS"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
