"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Shield, Loader2 } from "lucide-react";

interface VisaleCheckerProps {
  onVisaleConfirmed?: (visaleNumber: string) => void;
  defaultNumber?: string;
}

/**
 * VisaleChecker - Vérifie l'éligibilité et le numéro Visale
 * La garantie Visale est fournie gratuitement par Action Logement
 * pour les locataires de moins de 30 ans ou les salariés précaires.
 */
export function VisaleChecker({ onVisaleConfirmed, defaultNumber }: VisaleCheckerProps) {
  const [visaleNumber, setVisaleNumber] = useState(defaultNumber || "");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const handleCheck = async () => {
    if (!visaleNumber.trim()) return;

    setChecking(true);
    setResult(null);

    try {
      // Validation format: numéro Visale = 10-12 caractères alphanumériques
      const isValidFormat = /^[A-Z0-9]{8,12}$/i.test(visaleNumber.trim());

      if (!isValidFormat) {
        setResult({
          valid: false,
          message: "Le format du numéro Visale est invalide. Il doit contenir entre 8 et 12 caractères alphanumériques.",
        });
        return;
      }

      // Note: In production, this would call the Action Logement API
      // to verify the Visale certificate. For now, we validate the format.
      setResult({
        valid: true,
        message: "Le format du numéro Visale est valide. Le certificat sera vérifié par le propriétaire.",
      });

      onVisaleConfirmed?.(visaleNumber.trim());
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-base">Garantie Visale</CardTitle>
        </div>
        <CardDescription>
          La garantie Visale est un cautionnement gratuit accordé par Action Logement.
          Elle couvre les impayés de loyer et charges pendant toute la durée du bail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Qui est éligible ?</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Locataires de moins de 30 ans</li>
              <li>Salariés de plus de 30 ans en CDD, intérim, ou en période d'essai</li>
              <li>Salariés en mutation professionnelle</li>
              <li>Titulaires d'une promesse d'embauche de moins de 3 mois</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="visale-number">Numéro de visa Visale</Label>
          <div className="flex gap-3">
            <Input
              id="visale-number"
              value={visaleNumber}
              onChange={(e) => {
                setVisaleNumber(e.target.value.toUpperCase());
                setResult(null);
              }}
              placeholder="Ex: VISA2026XXXX"
              className="flex-1"
            />
            <Button
              onClick={handleCheck}
              disabled={!visaleNumber.trim() || checking}
              variant="outline"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Vérifier"
              )}
            </Button>
          </div>
        </div>

        {result && (
          <Alert
            className={
              result.valid
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }
          >
            {result.valid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription
              className={result.valid ? "text-green-800" : "text-red-800"}
            >
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        {result?.valid && (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800">
              Visale confirmé
            </Badge>
            <span className="text-sm text-muted-foreground">
              N° {visaleNumber}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
