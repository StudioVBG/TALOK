"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { FileStack, Loader2 } from "lucide-react";

export interface QuoteTemplateItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  tax_rate: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_validity_days: number;
  default_tax_rate: number;
  default_terms: string | null;
  default_payment_conditions: string | null;
  is_archived: boolean;
  usage_count: number;
  items: QuoteTemplateItem[];
}

interface QuoteTemplatePickerProps {
  onLoad: (template: QuoteTemplate) => void;
}

export function QuoteTemplatePicker({ onLoad }: QuoteTemplatePickerProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/provider/quote-templates", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Erreur de chargement");
        }
        const json = await res.json();
        if (!cancelled) setTemplates(json.templates || []);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Impossible de charger les templates",
            description: error instanceof Error ? error.message : "Réessayez plus tard",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const handleSelect = (template: QuoteTemplate) => {
    onLoad(template);
    setOpen(false);
    // Fire-and-forget : incrémente usage_count côté serveur (non bloquant)
    fetch(`/api/provider/quote-templates/${template.id}/use`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // ignore — pas critique pour le flux de creation de devis
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileStack className="mr-2 h-4 w-4" />
          Charger un template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Mes templates de devis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            Aucun template enregistré.
            <br />
            Créez un devis et sauvegardez-le comme template.
          </div>
        ) : (
          templates.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => handleSelect(t)}
              className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">
                {t.category ? `${t.category} · ` : ""}
                {t.items.length} ligne{t.items.length > 1 ? "s" : ""}
                {t.usage_count > 0 ? ` · ${t.usage_count}× utilisé` : ""}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
