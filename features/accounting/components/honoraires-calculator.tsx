"use client";

/**
 * Composant de calcul des honoraires de gestion
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHonorairesCalculator } from "../hooks/use-accounting";

interface HonorairesCalculatorProps {
  defaultLoyer?: number;
  defaultTaux?: number;
  defaultCodePostal?: string;
  onCalculate?: (result: any) => void;
}

export function HonorairesCalculator({
  defaultLoyer = 0,
  defaultTaux = 0.07,
  defaultCodePostal = "75000",
  onCalculate,
}: HonorairesCalculatorProps) {
  const [loyer, setLoyer] = useState(defaultLoyer);
  const [taux, setTaux] = useState(defaultTaux);
  const [codePostal, setCodePostal] = useState(defaultCodePostal);

  const { result, calculate } = useHonorairesCalculator();

  useEffect(() => {
    if (loyer > 0) {
      const calcul = calculate(loyer, taux, codePostal);
      onCalculate?.(calcul);
    }
  }, [loyer, taux, codePostal, calculate, onCalculate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Calcul des honoraires</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loyer">Loyer HC mensuel</Label>
            <div className="relative">
              <Input
                id="loyer"
                type="number"
                value={loyer || ""}
                onChange={(e) => setLoyer(parseFloat(e.target.value) || 0)}
                placeholder="1000"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                EUR
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taux">Taux honoraires HT</Label>
            <Select
              value={taux.toString()}
              onValueChange={(v) => setTaux(parseFloat(v))}
            >
              <SelectTrigger id="taux">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.05">5%</SelectItem>
                <SelectItem value="0.06">6%</SelectItem>
                <SelectItem value="0.07">7%</SelectItem>
                <SelectItem value="0.08">8%</SelectItem>
                <SelectItem value="0.10">10%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="codePostal">Code postal</Label>
            <Input
              id="codePostal"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              placeholder="75001"
              maxLength={5}
            />
          </div>
        </div>

        {result && loyer > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Honoraires HT</p>
                <p className="text-lg font-semibold">{result.montant_ht.toFixed(2)} EUR</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  TVA ({(result.tva_taux * 100).toFixed(1)}%)
                </p>
                <p className="text-lg font-semibold">{result.tva_montant.toFixed(2)} EUR</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Honoraires TTC</p>
                <p className="text-lg font-semibold text-primary">
                  {result.total_ttc.toFixed(2)} EUR
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net propriétaire</p>
                <p className="text-lg font-semibold text-green-600">
                  {result.net_proprietaire.toFixed(2)} EUR
                </p>
              </div>
            </div>

            {codePostal.startsWith("97") && (
              <p className="mt-3 text-xs text-muted-foreground">
                * Taux TVA réduit applicable pour les DOM-TOM
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
