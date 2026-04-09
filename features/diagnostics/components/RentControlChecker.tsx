"use client";

import { useState } from "react";
import { MapPin, TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RentControlResult } from "@/lib/validations/diagnostics";

const CITIES = [
  "Paris",
  "Lyon",
  "Lille",
  "Bordeaux",
  "Montpellier",
];

const TYPE_OPTIONS = [
  { value: "nu_ancien", label: "Location nue (ancien)" },
  { value: "meuble_ancien", label: "Location meublée (ancien)" },
  { value: "nu_neuf", label: "Location nue (neuf)" },
  { value: "meuble_neuf", label: "Location meublée (neuf)" },
];

interface RentControlCheckerProps {
  /** Pre-fill values */
  defaultCity?: string;
  defaultSurface?: number;
  defaultLoyer?: number;
  defaultNbPieces?: number;
  defaultType?: string;
}

export function RentControlChecker({
  defaultCity,
  defaultSurface,
  defaultLoyer,
  defaultNbPieces,
  defaultType,
}: RentControlCheckerProps) {
  const [city, setCity] = useState(defaultCity ?? "");
  const [typeLogement, setTypeLogement] = useState(defaultType ?? "nu_ancien");
  const [nbPieces, setNbPieces] = useState(defaultNbPieces?.toString() ?? "2");
  const [surface, setSurface] = useState(defaultSurface?.toString() ?? "");
  const [loyer, setLoyer] = useState(defaultLoyer?.toString() ?? "");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RentControlResult | null>(null);

  async function handleCheck() {
    if (!city || !surface || !loyer) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/rent-control/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          type_logement: typeLogement,
          nb_pieces: parseInt(nbPieces, 10),
          surface: parseFloat(surface),
          loyer: parseFloat(loyer),
        }),
      });

      if (res.ok) {
        setResult(await res.json());
      }
    } catch (err) {
      console.error("Error checking rent control:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-base">Encadrement des loyers</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Ville</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type de location</Label>
            <Select value={typeLogement} onValueChange={setTypeLogement}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nb pièces</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={nbPieces}
              onChange={(e) => setNbPieces(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Surface (m)</Label>
            <Input
              type="number"
              min="1"
              step="0.1"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              placeholder="Ex: 35"
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Loyer HC mensuel</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={loyer}
              onChange={(e) => setLoyer(e.target.value)}
              placeholder="Ex: 950"
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleCheck}
          disabled={loading || !city || !surface || !loyer}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Vérifier l'encadrement
        </Button>

        {result && (
          <div className={`p-4 rounded-lg space-y-3 ${
            !result.in_zone
              ? "bg-slate-50 border border-slate-200"
              : result.is_over_limit
                ? "bg-red-50 border border-red-200"
                : "bg-emerald-50 border border-emerald-200"
          }`}>
            {!result.in_zone ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4" />
                <span>Aucune donnée d'encadrement trouvée pour cette ville/configuration.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {result.is_over_limit ? (
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                  <span className={`text-sm font-semibold ${result.is_over_limit ? "text-red-800" : "text-emerald-800"}`}>
                    {result.is_over_limit
                      ? "Loyer au-dessus du plafond"
                      : "Loyer conforme"}
                  </span>
                  {result.is_over_limit && (
                    <Badge variant="destructive" className="ml-auto">
                      +{result.depassement} /mois
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded border">
                    <p className="text-muted-foreground">Loyer minoré</p>
                    <p className="font-bold text-sm">{result.loyer_minore} /m</p>
                  </div>
                  <div className="p-2 bg-white rounded border">
                    <p className="text-muted-foreground">Référence</p>
                    <p className="font-bold text-sm">{result.loyer_reference} /m</p>
                  </div>
                  <div className="p-2 bg-white rounded border">
                    <p className="text-muted-foreground">Majoré</p>
                    <p className="font-bold text-sm">{result.loyer_majore} /m</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Votre loyer : <strong>{result.loyer_m2} /m/mois</strong></span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
