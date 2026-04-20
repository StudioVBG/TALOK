"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Power,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface Broadcast {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  target_role: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  dismissible: boolean;
  created_at: string;
}

const SEVERITY_META = {
  info: { label: "Info", icon: Info, className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  success: { label: "Succès", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  warning: { label: "Attention", icon: AlertCircle, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  critical: { label: "Critique", icon: AlertTriangle, className: "bg-red-500/10 text-red-600 border-red-500/30" },
} as const;

const ROLE_OPTIONS = [
  { value: "all", label: "Tout le monde" },
  { value: "owner", label: "Propriétaires" },
  { value: "tenant", label: "Locataires" },
  { value: "agency", label: "Agences" },
  { value: "syndic", label: "Syndics" },
  { value: "provider", label: "Prestataires" },
  { value: "guarantor", label: "Garants" },
] as const;

export default function AdminBroadcastsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "platform_admin"]}>
      <AdminBroadcastsPageContent />
    </ProtectedRoute>
  );
}

function AdminBroadcastsPageContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "broadcasts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/broadcasts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur chargement broadcasts");
      }
      return res.json();
    },
  });

  const broadcasts: Broadcast[] = data?.broadcasts || [];

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/broadcasts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur mise à jour");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Broadcast mis à jour" });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const deleteBroadcast = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/broadcasts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur suppression");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Broadcast supprimé" });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6" /> Annonces globales
          </h1>
          <p className="text-muted-foreground">
            Diffusez un bandeau à tous les utilisateurs ou à un rôle spécifique.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau broadcast
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{(error as Error).message}</p>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Broadcasts</CardTitle>
          <CardDescription>
            {isLoading
              ? "Chargement..."
              : `${broadcasts.length} broadcast${broadcasts.length > 1 ? "s" : ""} au total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isLoading && broadcasts.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              Aucun broadcast. Créez-en un pour communiquer avec vos utilisateurs.
            </p>
          )}
          {broadcasts.map((b) => {
            const meta = SEVERITY_META[b.severity];
            const Icon = meta.icon;
            const targetLabel =
              ROLE_OPTIONS.find((r) => r.value === (b.target_role || "all"))?.label ||
              "Tout le monde";
            return (
              <div
                key={b.id}
                className={cn(
                  "rounded-lg border p-4 flex flex-col gap-3",
                  b.active ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0",
                        meta.className
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{b.title}</p>
                        <Badge variant="outline">{meta.label}</Badge>
                        <Badge variant="outline">Cible : {targetLabel}</Badge>
                        {b.active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline">Archivé</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {b.body}
                      </p>
                      {b.cta_url && (
                        <p className="text-xs text-muted-foreground mt-2">
                          CTA : <span className="font-mono">{b.cta_label || "Voir"}</span>{" "}
                          → <span className="font-mono">{b.cta_url}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Du {new Date(b.starts_at).toLocaleString("fr-FR")}
                        {b.ends_at ? ` au ${new Date(b.ends_at).toLocaleString("fr-FR")}` : " (sans fin)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive.mutate({ id: b.id, active: !b.active })}
                      disabled={toggleActive.isPending}
                    >
                      <Power className="w-3 h-3 mr-1" />
                      {b.active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Supprimer définitivement "${b.title}" ?`)) {
                          deleteBroadcast.mutate(b.id);
                        }
                      }}
                      disabled={deleteBroadcast.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <CreateBroadcastDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "broadcasts"] })}
      />
    </div>
  );
}

function CreateBroadcastDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "success" | "warning" | "critical">("info");
  const [targetRole, setTargetRole] = useState<string>("all");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [dismissible, setDismissible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setSeverity("info");
    setTargetRole("all");
    setCtaLabel("");
    setCtaUrl("");
    setEndsAt("");
    setDismissible(true);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Titre et message requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          severity,
          target_role: targetRole === "all" ? null : targetRole,
          cta_label: ctaLabel || null,
          cta_url: ctaUrl || null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          dismissible,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Erreur création");
      }
      toast({ title: "Broadcast créé" });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau broadcast</DialogTitle>
          <DialogDescription>
            Ce bandeau s&apos;affichera en haut de l&apos;application pour les utilisateurs ciblés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bc-title">Titre *</Label>
            <Input
              id="bc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Maintenance programmée dimanche"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="bc-body">Message *</Label>
            <Textarea
              id="bc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="La plateforme sera indisponible de 2h à 4h..."
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sévérité</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="warning">Attention</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cible</Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bc-cta-label">Texte du bouton (optionnel)</Label>
              <Input
                id="bc-cta-label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="En savoir plus"
              />
            </div>
            <div>
              <Label htmlFor="bc-cta-url">Lien (optionnel)</Label>
              <Input
                id="bc-cta-url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="/owner/dashboard ou https://..."
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bc-ends">Date de fin (optionnelle)</Label>
            <Input
              id="bc-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="bc-dismissible" className="cursor-pointer">
              Les utilisateurs peuvent fermer le bandeau
            </Label>
            <Switch id="bc-dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Publier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
