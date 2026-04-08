"use client";

import React, { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const EVENT_GROUPS = [
  {
    label: "Biens",
    events: [
      { value: "property.created", label: "Bien créé" },
      { value: "property.updated", label: "Bien modifié" },
      { value: "property.deleted", label: "Bien supprimé" },
    ],
  },
  {
    label: "Baux",
    events: [
      { value: "lease.created", label: "Bail créé" },
      { value: "lease.signed", label: "Bail signé" },
      { value: "lease.terminated", label: "Bail résilié" },
    ],
  },
  {
    label: "Paiements",
    events: [
      { value: "payment.received", label: "Paiement reçu" },
      { value: "payment.failed", label: "Paiement échoué" },
    ],
  },
  {
    label: "Documents",
    events: [
      { value: "document.created", label: "Document créé" },
      { value: "document.signed", label: "Document signé" },
    ],
  },
  {
    label: "Locataires",
    events: [
      { value: "tenant.invited", label: "Locataire invité" },
      { value: "tenant.moved_in", label: "Entrée locataire" },
      { value: "tenant.moved_out", label: "Sortie locataire" },
    ],
  },
  {
    label: "Factures",
    events: [
      { value: "invoice.created", label: "Facture créée" },
      { value: "invoice.paid", label: "Facture payée" },
      { value: "invoice.overdue", label: "Facture en retard" },
    ],
  },
  {
    label: "Tickets",
    events: [
      { value: "ticket.created", label: "Ticket créé" },
      { value: "ticket.resolved", label: "Ticket résolu" },
    ],
  },
  {
    label: "Comptabilité",
    events: [
      { value: "accounting.entry_created", label: "Écriture créée" },
    ],
  },
];

interface WebhookEditorProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function WebhookEditor({ onCreated, onCancel }: WebhookEditorProps) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev: string[]) =>
      prev.includes(event) ? prev.filter((e: string) => e !== event) : [...prev, event]
    );
  };

  const selectAll = () => {
    const allEvents = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.value));
    setSelectedEvents(allEvents);
  };

  const handleCreate = async () => {
    if (!url.trim()) {
      setError("L'URL est requise");
      return;
    }
    if (!url.startsWith("https://")) {
      setError("L'URL doit utiliser HTTPS");
      return;
    }
    if (selectedEvents.length === 0) {
      setError("Sélectionnez au moins un événement");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          events: selectedEvents,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la création");
        return;
      }

      setSecret(data.webhook?.secret || null);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show secret after creation
  if (secret) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Check className="h-5 w-5" />
            Webhook créé
          </CardTitle>
          <CardDescription>
            Copiez ce secret pour vérifier les signatures des webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input readOnly value={secret} className="font-mono text-sm bg-white" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              Utilisez ce secret pour vérifier la signature HMAC-SHA256 dans le header
              X-Talok-Signature de chaque webhook.
            </p>
          </div>
          <Button onClick={onCreated} className="w-full">
            J'ai copié le secret
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau webhook</CardTitle>
        <CardDescription>
          Recevez des notifications HTTP pour les événements Talok
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL */}
        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL de l'endpoint</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://mon-serveur.com/webhooks/talok"
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="webhook-desc">Description (optionnel)</Label>
          <Input
            id="webhook-desc"
            placeholder="Ex: Sync avec mon ERP"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          />
        </div>

        {/* Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Événements</Label>
            <Button variant="ghost" size="sm" className="text-xs" onClick={selectAll}>
              Tout sélectionner
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {EVENT_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                {group.events.map((event) => (
                  <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedEvents.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Création..." : "Créer le webhook"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
