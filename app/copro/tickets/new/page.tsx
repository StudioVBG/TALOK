"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Send, Loader2, AlertCircle, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const PRIORITIES = [
  { value: "normal", label: "Normale", helper: "Sous quelques jours" },
  { value: "urgent", label: "Urgent", helper: "Sous 48h" },
  { value: "emergency", label: "Urgence", helper: "Immédiat" },
];

export default function NewCoproTicketPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    description: "",
    priorite: "normal",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre || !form.description) {
      toast({
        title: "Champs manquants",
        description: "Indiquez l'objet et la description du signalement.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: form.titre,
          description: form.description,
          priorite: form.priorite,
          category: "parties_communes",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Impossible de créer le signalement");
      }

      toast({
        title: "Signalement envoyé",
        description: "Votre syndic a été notifié.",
      });
      router.push("/copro/tickets");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le signalement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Link
        href="/copro/tickets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux signalements
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Nouveau signalement
          </h1>
        </div>
        <p className="text-muted-foreground">
          Signalez un incident sur les parties communes (ascenseur, hall, parking, espaces verts...).
          Votre syndic en sera immédiatement informé.
        </p>
      </div>

      <Card className="bg-card border border-border">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="titre" className="text-sm font-semibold">
                Objet du signalement
              </Label>
              <Input
                id="titre"
                placeholder="Ex : Panne d'ascenseur, fuite parking, éclairage en panne..."
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Degré d'urgence</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, priorite: p.value })}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      form.priorite === p.value
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                        : "border-border hover:border-indigo-200"
                    )}
                  >
                    <div className="font-bold text-sm">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.helper}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold">
                Description détaillée
              </Label>
              <Textarea
                id="description"
                placeholder="Décrivez précisément le problème, sa localisation et depuis quand il est constaté."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[160px] p-4"
                required
              />
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <strong>En cas d'urgence vitale</strong> (incendie, fuite de gaz majeure,
                effondrement), contactez immédiatement les pompiers (18) ou le SAMU (15)
                avant tout signalement.
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-bold"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Envoyer le signalement
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
