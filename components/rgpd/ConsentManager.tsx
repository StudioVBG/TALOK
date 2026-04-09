"use client";

import { useState } from "react";
import { Shield, Check, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface ConsentItem {
  type: string;
  label: string;
  description: string;
  required: boolean;
  granted: boolean;
  version: string;
  grantedAt: string | null;
}

interface ConsentManagerProps {
  consents: ConsentItem[];
  onUpdate?: () => void;
}

export function ConsentManager({ consents: initialConsents, onUpdate }: ConsentManagerProps) {
  const [consents, setConsents] = useState<ConsentItem[]>(initialConsents);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const { toast } = useToast();

  const toggleConsent = (type: string) => {
    setConsents((prev) =>
      prev.map((c) => {
        if (c.type === type && !c.required) {
          return { ...c, granted: !c.granted };
        }
        return c;
      })
    );
    setChanged(true);
  };

  const saveConsents = async () => {
    setSaving(true);
    try {
      const updates = consents
        .filter((c) => !c.required)
        .map((c) => ({
          consent_type: c.type,
          granted: c.granted,
          version: c.version,
        }));

      const res = await fetch("/api/rgpd/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consents: updates }),
      });

      if (!res.ok) throw new Error("Erreur lors de la sauvegarde");

      toast({
        title: "Preferences mises a jour",
        description: "Vos choix de consentement ont ete enregistres.",
      });
      setChanged(false);
      onUpdate?.();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos preferences. Reessayez.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Gestion des consentements</CardTitle>
            <CardDescription>
              Controlez l&apos;utilisation de vos donnees personnelles
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {consents.map((consent) => (
          <div
            key={consent.type}
            className="flex items-center justify-between py-3 border-b last:border-0"
          >
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{consent.label}</p>
                {consent.required && (
                  <Badge variant="secondary" className="text-xs">
                    Obligatoire
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{consent.description}</p>
              {consent.grantedAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {consent.granted ? "Accepte" : "Refuse"} le{" "}
                  {new Date(consent.grantedAt).toLocaleDateString("fr-FR")}
                  {" — v"}{consent.version}
                </p>
              )}
            </div>
            <Switch
              checked={consent.granted}
              disabled={consent.required}
              onCheckedChange={() => toggleConsent(consent.type)}
              aria-label={consent.label}
            />
          </div>
        ))}

        {changed && (
          <Button onClick={saveConsents} disabled={saving} className="w-full gap-2">
            <Check className="h-4 w-4" />
            {saving ? "Enregistrement..." : "Enregistrer mes choix"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
