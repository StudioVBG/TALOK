"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  createAvailabilityPatternSchema,
  type CreateAvailabilityPattern,
} from "@/lib/validations";

// Types
interface AvailabilityPattern {
  id: string;
  property_id: string | null;
  recurrence_type: "daily" | "weekly" | "monthly" | "custom";
  day_of_week: number[];
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  valid_from: string;
  valid_until: string | null;
  max_bookings_per_slot: number;
  auto_confirm: boolean;
  is_active: boolean;
  created_at: string;
}

interface AvailabilityEditorProps {
  propertyId: string;
  propertyAddress?: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 0, label: "Dimanche", short: "Dim" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2h" },
];

const BUFFER_OPTIONS = [
  { value: 0, label: "Aucun" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1h" },
];

// API Functions
async function fetchPatterns(propertyId: string): Promise<AvailabilityPattern[]> {
  const res = await fetch(
    `/api/visit-scheduling/availability?property_id=${propertyId}`
  );
  if (!res.ok) throw new Error("Erreur lors du chargement des disponibilités");
  const data = await res.json();
  return data.patterns || [];
}

async function createPattern(
  data: CreateAvailabilityPattern & { property_id: string }
): Promise<AvailabilityPattern> {
  const res = await fetch("/api/visit-scheduling/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la création");
  }
  const result = await res.json();
  return result.pattern;
}

async function updatePattern(
  id: string,
  data: Partial<CreateAvailabilityPattern>
): Promise<AvailabilityPattern> {
  const res = await fetch(`/api/visit-scheduling/availability/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la mise à jour");
  }
  const result = await res.json();
  return result.pattern;
}

async function deletePattern(id: string): Promise<void> {
  const res = await fetch(`/api/visit-scheduling/availability/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la suppression");
  }
}

// Component
export function AvailabilityEditor({
  propertyId,
  propertyAddress,
}: AvailabilityEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<AvailabilityPattern | null>(
    null
  );
  const queryClient = useQueryClient();

  // Query patterns
  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ["availability-patterns", propertyId],
    queryFn: () => fetchPatterns(propertyId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["availability-patterns", propertyId],
      });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAvailabilityPattern>;
    }) => updatePattern(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["availability-patterns", propertyId],
      });
      setEditingPattern(null);
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["availability-patterns", propertyId],
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updatePattern(id, { is_active } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["availability-patterns", propertyId],
      });
    },
  });

  // Form
  const form = useForm<CreateAvailabilityPattern>({
    resolver: zodResolver(createAvailabilityPatternSchema),
    defaultValues: {
      recurrence_type: "weekly",
      day_of_week: [6],
      start_time: "10:00",
      end_time: "18:00",
      slot_duration_minutes: 30,
      buffer_minutes: 15,
      max_bookings_per_slot: 1,
      auto_confirm: false,
    },
  });

  const handleOpenDialog = (pattern?: AvailabilityPattern) => {
    if (pattern) {
      setEditingPattern(pattern);
      form.reset({
        recurrence_type: pattern.recurrence_type,
        day_of_week: pattern.day_of_week,
        start_time: pattern.start_time,
        end_time: pattern.end_time,
        slot_duration_minutes: pattern.slot_duration_minutes,
        buffer_minutes: pattern.buffer_minutes,
        max_bookings_per_slot: pattern.max_bookings_per_slot,
        auto_confirm: pattern.auto_confirm,
        valid_until: pattern.valid_until || undefined,
      });
    } else {
      setEditingPattern(null);
      form.reset({
        recurrence_type: "weekly",
        day_of_week: [6],
        start_time: "10:00",
        end_time: "18:00",
        slot_duration_minutes: 30,
        buffer_minutes: 15,
        max_bookings_per_slot: 1,
        auto_confirm: false,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CreateAvailabilityPattern) => {
    if (editingPattern) {
      updateMutation.mutate({ id: editingPattern.id, data });
    } else {
      createMutation.mutate({ ...data, property_id: propertyId });
    }
  };

  const getDayLabels = (days: number[]) => {
    return days
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.short)
      .join(", ");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Disponibilités pour les visites
            </CardTitle>
            <CardDescription>
              {propertyAddress
                ? `Configurez vos créneaux de visite pour ${propertyAddress}`
                : "Configurez vos créneaux de visite"}
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPattern
                    ? "Modifier la disponibilité"
                    : "Nouvelle disponibilité"}
                </DialogTitle>
                <DialogDescription>
                  Définissez vos créneaux de visite récurrents
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Jours de la semaine */}
                  <FormField
                    control={form.control}
                    name="day_of_week"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jours de visite</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <Button
                              key={day.value}
                              type="button"
                              variant={
                                field.value.includes(day.value)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                const newValue = field.value.includes(day.value)
                                  ? field.value.filter((d) => d !== day.value)
                                  : [...field.value, day.value];
                                field.onChange(
                                  newValue.length > 0 ? newValue : [day.value]
                                );
                              }}
                            >
                              {day.short}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Plage horaire */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heure de début</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heure de fin</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Durée et buffer */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="slot_duration_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Durée d'une visite</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DURATION_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={String(opt.value)}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="buffer_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temps entre visites</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BUFFER_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={String(opt.value)}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Options avancées */}
                  <Separator />

                  <FormField
                    control={form.control}
                    name="max_bookings_per_slot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visiteurs max par créneau</FormLabel>
                        <Select
                          value={String(field.value)}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n} {n === 1 ? "groupe" : "groupes"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Permet les visites groupées si supérieur à 1
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="auto_confirm"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Confirmation automatique</FormLabel>
                          <FormDescription>
                            Les réservations seront confirmées automatiquement
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending || updateMutation.isPending
                      }
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingPattern ? "Enregistrer" : "Créer"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Aucune disponibilité définie</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Ajoutez vos créneaux de visite pour permettre aux locataires de
              réserver des visites en ligne.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-4 transition-colors",
                  !pattern.is_active && "bg-muted/50 opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getDayLabels(pattern.day_of_week)}
                      </span>
                      {!pattern.is_active && (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                      {pattern.auto_confirm && (
                        <Badge variant="outline" className="text-xs">
                          Auto-confirm
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pattern.start_time} - {pattern.end_time} • Créneaux de{" "}
                      {pattern.slot_duration_minutes} min
                      {pattern.buffer_minutes > 0 &&
                        ` • ${pattern.buffer_minutes} min entre visites`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={pattern.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: pattern.id,
                        is_active: checked,
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(pattern)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (
                        confirm(
                          "Supprimer cette disponibilité ? Les créneaux futurs seront également supprimés."
                        )
                      ) {
                        deleteMutation.mutate(pattern.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
