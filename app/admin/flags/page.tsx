"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  useFeatureFlags,
  useUpdateFeatureFlag,
  useCreateFeatureFlag,
  useDeleteFeatureFlag,
} from "@/lib/hooks/use-admin-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Plus,
  Flag,
  Trash2,
  Loader2,
  ToggleLeft,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";

interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rollout_percentage: number;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export default function AdminFlagsPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data, isLoading, refetch } = useFeatureFlags();
  const updateMutation = useUpdateFeatureFlag();
  const createMutation = useCreateFeatureFlag();
  const deleteMutation = useDeleteFeatureFlag();

  const flags: FeatureFlag[] = (data?.flags || []) as FeatureFlag[];

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await updateMutation.mutateAsync({
        id: flag.id,
        enabled: !flag.enabled,
      });
      toast({
        title: `Flag "${flag.name}" ${!flag.enabled ? "active" : "desactive"}`,
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleRolloutChange = async (flag: FeatureFlag, percentage: number) => {
    try {
      await updateMutation.mutateAsync({
        id: flag.id,
        rollout_percentage: percentage,
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: newName.trim().toLowerCase().replace(/\s+/g, "_"),
        description: newDescription,
      });
      toast({ title: "Flag cree" });
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Echec",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: `Flag "${deleteTarget.name}" supprime` });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">
            Activation progressive des fonctionnalites
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau flag
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-500/10 p-4 text-center">
          <Flag className="mx-auto mb-1 h-5 w-5 text-slate-600" />
          <p className="text-2xl font-bold">{flags.length}</p>
          <p className="text-xs text-muted-foreground">Total flags</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
          <ToggleLeft className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{enabledCount}</p>
          <p className="text-xs text-muted-foreground">Actifs</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4 text-center">
          <Percent className="mx-auto mb-1 h-5 w-5 text-amber-600" />
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
            {flags.filter((f) => f.enabled && f.rollout_percentage < 100).length}
          </p>
          <p className="text-xs text-muted-foreground">Rollout partiel</p>
        </div>
      </div>

      {/* Flags List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Flag className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Aucun feature flag configure</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Creer le premier flag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flags.map((flag, index) => (
            <motion.div
              key={flag.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={cn(
                "transition-colors",
                flag.enabled ? "border-emerald-200 dark:border-emerald-800/50" : ""
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-mono font-semibold text-sm">{flag.name}</h3>
                        <Badge className={cn(
                          flag.enabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {flag.enabled ? "Actif" : "Inactif"}
                        </Badge>
                        {flag.enabled && flag.rollout_percentage < 100 && (
                          <Badge variant="outline" className="text-xs">
                            {flag.rollout_percentage}% rollout
                          </Badge>
                        )}
                      </div>

                      {flag.description && (
                        <p className="text-sm text-muted-foreground">{flag.description}</p>
                      )}

                      {/* Rollout slider */}
                      {flag.enabled && (
                        <div className="flex items-center gap-4 max-w-md">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Rollout:
                          </Label>
                          <Slider
                            value={[flag.rollout_percentage]}
                            onValueCommit={(v) => handleRolloutChange(flag, v[0])}
                            min={0}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-10 text-right">
                            {flag.rollout_percentage}%
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Mis a jour le {formatDateShort(flag.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={() => handleToggle(flag)}
                        disabled={updateMutation.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => setDeleteTarget(flag)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Feature Flag</DialogTitle>
            <DialogDescription>
              Le nom sera automatiquement formate en snake_case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                placeholder="ex: new_payment_flow"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Description du feature flag..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Creer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le flag ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le flag "{deleteTarget?.name}" sera definitivement supprime.
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
