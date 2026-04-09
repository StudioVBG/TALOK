"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Droplet,
  Zap,
  Thermometer,
  Lock,
  HelpCircle,
  Bug,
  Volume2,
  Building2,
  Settings,
  CloudRain,
  Loader2,
  Send,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "plomberie", label: "Plomberie", icon: Droplet, color: "text-blue-500" },
  { value: "electricite", label: "Électricité", icon: Zap, color: "text-amber-500" },
  { value: "serrurerie", label: "Serrurerie", icon: Lock, color: "text-slate-600" },
  { value: "chauffage", label: "Chauffage", icon: Thermometer, color: "text-red-500" },
  { value: "humidite", label: "Humidité", icon: CloudRain, color: "text-cyan-500" },
  { value: "nuisibles", label: "Nuisibles", icon: Bug, color: "text-green-600" },
  { value: "bruit", label: "Bruit", icon: Volume2, color: "text-purple-500" },
  { value: "parties_communes", label: "Parties communes", icon: Building2, color: "text-indigo-500" },
  { value: "equipement", label: "Équipement", icon: Settings, color: "text-orange-500" },
  { value: "autre", label: "Autre", icon: HelpCircle, color: "text-muted-foreground" },
];

const PRIORITIES = [
  { value: "low", label: "Basse", description: "Peut attendre", icon: ArrowDown, color: "text-slate-500" },
  { value: "normal", label: "Normale", description: "Dans la semaine", icon: ArrowUp, color: "text-blue-500" },
  { value: "urgent", label: "Urgent", description: "Sous 48h", icon: AlertTriangle, color: "text-orange-500" },
  { value: "emergency", label: "Urgence", description: "Immédiat", icon: Flame, color: "text-red-500" },
];

interface TicketCreateFormProps {
  propertyId: string;
  leaseId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TicketCreateForm({
  propertyId,
  leaseId,
  onSuccess,
  onCancel,
}: TicketCreateFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    description: "",
    category: "",
    priorite: "normal",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.titre || !form.description || !form.category) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          lease_id: leaseId || null,
          titre: form.titre,
          description: form.description,
          category: form.category,
          priorite: form.priorite,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }

      toast({ title: "Ticket créé", description: "Votre demande a été enregistrée." });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le ticket.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="titre" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Titre
        </Label>
        <Input
          id="titre"
          placeholder="Ex: Fuite d'eau sous l'évier"
          value={form.titre}
          onChange={(e) => setForm({ ...form, titre: e.target.value })}
          className="h-12"
          required
        />
      </div>

      {/* Category grid */}
      <div className="space-y-2">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Catégorie
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setForm({ ...form, category: cat.value })}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                form.category === cat.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              )}
            >
              <cat.icon className={cn("h-5 w-5", form.category === cat.value ? "text-indigo-600" : cat.color)} />
              <span className={cn(
                "text-[11px] font-bold",
                form.category === cat.value ? "text-indigo-600" : "text-muted-foreground"
              )}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Priorité
        </Label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setForm({ ...form, priorite: p.value })}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                form.priorite === p.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <p.icon className={cn("h-4 w-4", form.priorite === p.value ? "text-indigo-600" : p.color)} />
              <span className={cn(
                "text-[11px] font-bold",
                form.priorite === p.value ? "text-indigo-600" : "text-muted-foreground"
              )}>
                {p.label}
              </span>
              <span className="text-[9px] text-muted-foreground">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Décrivez le problème en détail, sa localisation et les circonstances..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-[150px]"
          required
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Créer le ticket
        </Button>
      </div>
    </form>
  );
}
