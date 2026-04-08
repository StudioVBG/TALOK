"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, User, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Provider {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  provider_profile?: {
    type_services: string[];
  } | null;
}

interface AssignProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketCategory?: string | null;
  onAssigned: () => void;
}

export function AssignProviderModal({
  open,
  onOpenChange,
  ticketId,
  ticketCategory,
  onAssigned,
}: AssignProviderModalProps) {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    loadProviders();
  }, [open]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, nom, prenom, telephone, provider_profiles(type_services)")
        .eq("role", "provider")
        .order("nom");

      setProviders(
        (data || []).map((p: any) => ({
          ...p,
          provider_profile: p.provider_profiles?.[0] || null,
        }))
      );
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les prestataires", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (providerId: string) => {
    setAssigning(providerId);
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }

      toast({ title: "Prestataire assigné", description: "Le ticket a été assigné avec succès." });
      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible d'assigner", variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  };

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      p.prenom.toLowerCase().includes(q) ||
      (p.provider_profile?.type_services || []).some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assigner un prestataire</DialogTitle>
          <DialogDescription>
            Sélectionnez un prestataire pour intervenir sur ce ticket.
            {ticketCategory && (
              <Badge variant="outline" className="ml-2 capitalize">
                {ticketCategory}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un prestataire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto space-y-2 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Aucun prestataire trouvé.
            </p>
          ) : (
            filtered.map((provider) => {
              const initials =
                (provider.prenom?.[0] || "") + (provider.nom?.[0] || "");

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border border-border",
                    "hover:bg-muted/50 transition-colors cursor-pointer"
                  )}
                  onClick={() => !assigning && handleAssign(provider.id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                      {initials.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">
                      {provider.prenom} {provider.nom}
                    </p>
                    {provider.provider_profile?.type_services?.length ? (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {provider.provider_profile.type_services.slice(0, 3).map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-[10px] py-0 capitalize"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!!assigning}
                  >
                    {assigning === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Assigner"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
