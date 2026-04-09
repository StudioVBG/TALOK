"use client";

import { useState } from "react";
import { Plus, Trash2, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useSeasonalRates, useCreateRate } from "@/features/seasonal/hooks/use-seasonal";
import type { SeasonalRate, SeasonName } from "@/lib/types/seasonal";

const SEASON_CONFIG: Record<SeasonName, { label: string; color: string }> = {
  haute: { label: "Haute saison", color: "text-red-600" },
  moyenne: { label: "Moyenne saison", color: "text-amber-600" },
  basse: { label: "Basse saison", color: "text-green-600" },
  fetes: { label: "Fêtes / Événements", color: "text-purple-600" },
};

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface RateEditorProps {
  listingId: string;
}

export function RateEditor({ listingId }: RateEditorProps) {
  const { data, isLoading } = useSeasonalRates(listingId);
  const createRate = useCreateRate(listingId);
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    season_name: "haute" as SeasonName,
    start_date: "",
    end_date: "",
    nightly_rate: "",
    weekly_rate: "",
    monthly_rate: "",
  });

  const rates = data?.rates ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nightlyRateCents = Math.round(parseFloat(form.nightly_rate) * 100);
    if (!nightlyRateCents || nightlyRateCents <= 0) {
      toast({ title: "Tarif nuitée obligatoire", variant: "destructive" });
      return;
    }

    try {
      await createRate.mutateAsync({
        season_name: form.season_name,
        start_date: form.start_date,
        end_date: form.end_date,
        nightly_rate_cents: nightlyRateCents,
        ...(form.weekly_rate ? { weekly_rate_cents: Math.round(parseFloat(form.weekly_rate) * 100) } : {}),
        ...(form.monthly_rate ? { monthly_rate_cents: Math.round(parseFloat(form.monthly_rate) * 100) } : {}),
      });
      toast({ title: "Tarif ajouté" });
      setIsAdding(false);
      setForm({ season_name: "haute", start_date: "", end_date: "", nightly_rate: "", weekly_rate: "", monthly_rate: "" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Tarifs par saison</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add form */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg border bg-muted/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Saison</label>
                <Select value={form.season_name} onValueChange={(v) => setForm({ ...form, season_name: v as SeasonName })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEASON_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tarif / nuit</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="80.00"
                    className="pl-9"
                    value={form.nightly_rate}
                    onChange={(e) => setForm({ ...form, nightly_rate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Début</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tarif / semaine (optionnel)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="500.00"
                  value={form.weekly_rate}
                  onChange={(e) => setForm({ ...form, weekly_rate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tarif / mois (optionnel)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="1800.00"
                  value={form.monthly_rate}
                  onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createRate.isPending}>
                {createRate.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Annuler
              </Button>
            </div>
          </form>
        )}

        {/* Rate list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : rates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun tarif configuré
          </p>
        ) : (
          <div className="space-y-2">
            {rates.map((rate) => (
              <RateRow key={rate.id} rate={rate} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RateRow({ rate }: { rate: SeasonalRate }) {
  const config = SEASON_CONFIG[rate.season_name] ?? SEASON_CONFIG.basse;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div>
          <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(rate.start_date).toLocaleDateString("fr-FR")} — {new Date(rate.end_date).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatCents(rate.nightly_rate_cents)} € / nuit</p>
        {rate.weekly_rate_cents && (
          <p className="text-xs text-muted-foreground">{formatCents(rate.weekly_rate_cents)} € / sem.</p>
        )}
      </div>
    </div>
  );
}
