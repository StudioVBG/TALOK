"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ClipboardList, 
  Plus, 
  RotateCcw, 
  CheckCircle2, 
  Clock,
  Trash2,
  Sparkles,
  Calendar
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Roommate {
  id: string;
  name: string;
  avatar?: string;
}

interface Chore {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  current_assignee_id: string;
  last_completed?: string;
  next_due?: string;
  completed_this_period: boolean;
}

interface Props {
  leaseId: string;
  roommates: Roommate[];
  currentUserId: string;
}

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Quotidien", days: 1 },
  { value: "weekly", label: "Hebdomadaire", days: 7 },
  { value: "biweekly", label: "Bi-mensuel", days: 14 },
  { value: "monthly", label: "Mensuel", days: 30 },
];

const PRESET_CHORES = [
  { name: "Aspirateur salon", frequency: "weekly", icon: "🧹" },
  { name: "Nettoyage cuisine", frequency: "daily", icon: "🍳" },
  { name: "Nettoyage salle de bain", frequency: "weekly", icon: "🚿" },
  { name: "Sortir les poubelles", frequency: "weekly", icon: "🗑️" },
  { name: "Lessive commune", frequency: "weekly", icon: "👕" },
  { name: "Courses", frequency: "weekly", icon: "🛒" },
  { name: "Arroser les plantes", frequency: "weekly", icon: "🌱" },
  { name: "Nettoyage frigo", frequency: "monthly", icon: "❄️" },
];

export function ColocChores({ leaseId, roommates, currentUserId }: Props) {
  const { toast } = useToast();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newChore, setNewChore] = useState({
    name: "",
    frequency: "weekly" as Chore["frequency"],
  });

  useEffect(() => {
    fetchChores();
  }, [leaseId]);

  const fetchChores = async () => {
    try {
      // Simuler les données pour la démo
      const mockChores: Chore[] = [
        {
          id: "1",
          name: "Aspirateur salon",
          frequency: "weekly",
          current_assignee_id: currentUserId,
          last_completed: "2025-01-20",
          next_due: "2025-01-27",
          completed_this_period: false,
        },
        {
          id: "2",
          name: "Nettoyage cuisine",
          frequency: "daily",
          current_assignee_id: roommates[1]?.id || currentUserId,
          next_due: new Date().toISOString().split("T")[0],
          completed_this_period: true,
        },
        {
          id: "3",
          name: "Sortir les poubelles",
          frequency: "weekly",
          current_assignee_id: roommates.length > 2 ? roommates[2].id : currentUserId,
          next_due: "2025-01-25",
          completed_this_period: false,
        },
      ];

      setChores(mockChores);
    } catch (error) {
      console.error("Erreur chargement tâches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChore = async () => {
    if (!newChore.name) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un nom de tâche",
        variant: "destructive",
      });
      return;
    }

    try {
      const chore: Chore = {
        id: Date.now().toString(),
        name: newChore.name,
        frequency: newChore.frequency,
        current_assignee_id: currentUserId,
        next_due: new Date().toISOString().split("T")[0],
        completed_this_period: false,
      };

      setChores([...chores, chore]);
      toast({
        title: "Tâche ajoutée",
        description: `"${newChore.name}" a été ajoutée au planning`,
      });

      setDialogOpen(false);
      setNewChore({ name: "", frequency: "weekly" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la tâche",
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (choreId: string) => {
    setChores(chores.map(c => 
      c.id === choreId 
        ? { ...c, completed_this_period: !c.completed_this_period, last_completed: new Date().toISOString().split("T")[0] }
        : c
    ));

    const chore = chores.find(c => c.id === choreId);
    toast({
      title: chore?.completed_this_period ? "Tâche rouverte" : "Tâche terminée !",
      description: chore?.name,
    });
  };

  const handleRotate = async () => {
    const rotatedChores = chores.map(chore => {
      const currentIndex = roommates.findIndex(r => r.id === chore.current_assignee_id);
      const nextIndex = (currentIndex + 1) % roommates.length;
      return {
        ...chore,
        current_assignee_id: roommates[nextIndex].id,
        completed_this_period: false,
      };
    });

    setChores(rotatedChores);
    toast({
      title: "Rotation effectuée !",
      description: "Les tâches ont été redistribuées entre les colocataires",
    });
  };

  const handleDeleteChore = (choreId: string) => {
    setChores(chores.filter(c => c.id !== choreId));
    toast({
      title: "Tâche supprimée",
    });
  };

  const getAssigneeName = (assigneeId: string) => {
    if (assigneeId === currentUserId) return "Vous";
    return roommates.find(r => r.id === assigneeId)?.name || "Non assigné";
  };

  const getFrequencyLabel = (frequency: string) => {
    return FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label || frequency;
  };

  const getMyChores = () => chores.filter(c => c.current_assignee_id === currentUserId);
  const getOthersChores = () => chores.filter(c => c.current_assignee_id !== currentUserId);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement du planning...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Planning des tâches
          </h2>
          <p className="text-muted-foreground">
            {chores.length} tâche(s) • {getMyChores().filter(c => !c.completed_this_period).length} à faire pour vous
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRotate}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Faire tourner
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle tâche
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter une tâche</DialogTitle>
                <DialogDescription>
                  Créez une nouvelle tâche ménagère à partager
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la tâche</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Aspirateur salon"
                    value={newChore.name}
                    onChange={(e) => setNewChore({ ...newChore, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select
                    value={newChore.frequency}
                    onValueChange={(value) => setNewChore({ ...newChore, frequency: value as Chore["frequency"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map(freq => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preset suggestions */}
                <div className="space-y-2">
                  <Label>Suggestions rapides</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_CHORES.slice(0, 4).map(preset => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        onClick={() => setNewChore({ name: preset.name, frequency: preset.frequency as Chore["frequency"] })}
                      >
                        {preset.icon} {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddChore}>
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* My chores */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Mes tâches
            </CardTitle>
            <CardDescription>
              {getMyChores().filter(c => c.completed_this_period).length} / {getMyChores().length} terminée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getMyChores().length > 0 ? (
              <div className="space-y-3">
                {getMyChores().map(chore => (
                  <div
                    key={chore.id}
                    className={`flex items-center justify-between p-4 rounded-lg border bg-background transition-all ${
                      chore.completed_this_period ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={chore.completed_this_period}
                        onCheckedChange={() => handleToggleComplete(chore.id)}
                        className="h-5 w-5"
                      />
                      <div>
                        <p className={`font-medium ${chore.completed_this_period ? "line-through" : ""}`}>
                          {chore.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getFrequencyLabel(chore.frequency)}
                          </Badge>
                          {chore.next_due && !chore.completed_this_period && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(chore.next_due).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteChore(chore.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
                <p className="font-medium text-emerald-600">Aucune tâche assignée !</p>
                <p className="text-sm text-muted-foreground">
                  Vous êtes à jour
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Others' chores */}
      {getOthersChores().length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tâches des colocataires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getOthersChores().map(chore => {
                  const assignee = roommates.find(r => r.id === chore.current_assignee_id);
                  return (
                    <div
                      key={chore.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        chore.completed_this_period ? "bg-muted/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {assignee?.name.split(" ").map(n => n[0]).join("") || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className={`font-medium ${chore.completed_this_period ? "line-through opacity-60" : ""}`}>
                            {chore.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Assigné à {assignee?.name || "Inconnu"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getFrequencyLabel(chore.frequency)}
                        </Badge>
                        {chore.completed_this_period ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {chores.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune tâche définie</h3>
            <p className="text-muted-foreground mb-4">
              Créez votre premier planning de tâches ménagères
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une tâche
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

