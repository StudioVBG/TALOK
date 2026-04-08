"use client";

import { useState } from "react";
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
import { Calculator, Euro } from "lucide-react";

interface FeeCalculatorProps {
  defaultRate?: number;
  defaultType?: "percentage" | "fixed";
}

export function FeeCalculator({
  defaultRate = 7,
  defaultType = "percentage",
}: FeeCalculatorProps) {
  const [feeType, setFeeType] = useState(defaultType);
  const [rate, setRate] = useState(defaultRate);
  const [fixedAmount, setFixedAmount] = useState(0);
  const [rentAmount, setRentAmount] = useState(0);

  const monthlyFee = feeType === "percentage"
    ? rentAmount * (rate / 100)
    : fixedAmount;
  const annualFee = monthlyFee * 12;
  const netOwner = rentAmount - monthlyFee;

  return (
    <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-indigo-600" />
          Simulateur d&apos;honoraires
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Loyer mensuel (EUR)</Label>
            <Input
              type="number"
              min="0"
              value={rentAmount || ""}
              onChange={(e) => setRentAmount(parseFloat(e.target.value) || 0)}
              placeholder="1200"
            />
          </div>
          <div className="space-y-2">
            <Label>Type de calcul</Label>
            <Select value={feeType} onValueChange={(v) => setFeeType(v as "percentage" | "fixed")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Pourcentage</SelectItem>
                <SelectItem value="fixed">Forfait fixe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {feeType === "percentage" ? (
            <div className="space-y-2">
              <Label>Taux (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={rate || ""}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Forfait mensuel (EUR)</Label>
              <Input
                type="number"
                min="0"
                value={fixedAmount || ""}
                onChange={(e) => setFixedAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {rentAmount > 0 && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
              <Euro className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {monthlyFee.toFixed(2)} EUR
              </p>
              <p className="text-xs text-muted-foreground">Commission/mois</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10">
              <Euro className="w-5 h-5 mx-auto mb-1 text-purple-600" />
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {annualFee.toFixed(2)} EUR
              </p>
              <p className="text-xs text-muted-foreground">Commission/an</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <Euro className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {netOwner.toFixed(2)} EUR
              </p>
              <p className="text-xs text-muted-foreground">Net proprietaire/mois</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
