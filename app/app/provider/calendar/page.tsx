"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  List
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/helpers/format";
import { PageTransition } from "@/components/ui/page-transition";

interface Intervention {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  priority: "basse" | "normale" | "haute";
  status: "assigned" | "scheduled" | "in_progress" | "done" | "cancelled";
  scheduled_date?: string;
  scheduled_time?: string;
  property_address: string;
  property_city: string;
  owner_name: string;
  estimated_cost?: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  assigned: { label: "À planifier", color: "text-amber-600", bgColor: "bg-amber-100" },
  scheduled: { label: "Planifié", color: "text-blue-600", bgColor: "bg-blue-100" },
  in_progress: { label: "En cours", color: "text-purple-600", bgColor: "bg-purple-100" },
  done: { label: "Terminé", color: "text-green-600", bgColor: "bg-green-100" },
  cancelled: { label: "Annulé", color: "text-gray-600", bgColor: "bg-gray-100" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  basse: { label: "Basse", color: "bg-gray-100 text-gray-600" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600" },
  haute: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function ProviderCalendarPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  
  const supabase = createClient();

  useEffect(() => {
    fetchInterventions();
  }, [currentDate]);

  const fetchInterventions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      // Récupérer les interventions du mois
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data: workOrders } = await supabase
        .from("work_orders")
        .select(`
          id,
          ticket_id,
          date_intervention_prevue,
          cout_estime,
          cout_final,
          statut,
          created_at,
          ticket:tickets (
            titre,
            description,
            priorite,
            properties (
              adresse_complete,
              ville,
              owner_id
            )
          )
        `)
        .eq("provider_id", profile.id)
        .gte("date_intervention_prevue", startOfMonth.toISOString().split("T")[0])
        .lte("date_intervention_prevue", endOfMonth.toISOString().split("T")[0])
        .order("date_intervention_prevue", { ascending: true });

      // Récupérer aussi les interventions non planifiées
      const { data: unscheduled } = await supabase
        .from("work_orders")
        .select(`
          id,
          ticket_id,
          date_intervention_prevue,
          cout_estime,
          cout_final,
          statut,
          created_at,
          ticket:tickets (
            titre,
            description,
            priorite,
            properties (
              adresse_complete,
              ville,
              owner_id
            )
          )
        `)
        .eq("provider_id", profile.id)
        .is("date_intervention_prevue", null)
        .in("statut", ["assigned", "scheduled"]);

      const all = [...(workOrders || []), ...(unscheduled || [])];

      setInterventions(all.map((wo: any) => ({
        id: wo.id,
        ticket_id: wo.ticket_id,
        title: wo.ticket?.titre || "Intervention",
        description: wo.ticket?.description || "",
        priority: wo.ticket?.priorite || "normale",
        status: wo.statut,
        scheduled_date: wo.date_intervention_prevue,
        property_address: wo.ticket?.properties?.adresse_complete || "",
        property_city: wo.ticket?.properties?.ville || "",
        owner_name: "", // À enrichir si nécessaire
        estimated_cost: wo.cout_estime,
        created_at: wo.created_at,
      })));
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le calendrier",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculer les jours du mois
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Ajuster pour commencer le lundi (0 = lundi, 6 = dimanche)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;
    
    const days: { date: Date; isCurrentMonth: boolean; interventions: Intervention[] }[] = [];
    
    // Jours du mois précédent
    const prevMonth = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({ date, isCurrentMonth: false, interventions: [] });
    }
    
    // Jours du mois actuel
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      const dayInterventions = interventions.filter(
        int => int.scheduled_date === dateStr
      );
      days.push({ date, isCurrentMonth: true, interventions: dayInterventions });
    }
    
    // Jours du mois suivant pour compléter la grille
    const remaining = 42 - days.length; // 6 semaines * 7 jours
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, interventions: [] });
    }
    
    return days;
  }, [currentDate, interventions]);

  const unscheduledInterventions = interventions.filter(int => !int.scheduled_date);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Calendrier
            </h1>
            <p className="text-muted-foreground">
              Planifiez et suivez vos interventions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Unscheduled interventions alert */}
        {unscheduledInterventions.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">
                    {unscheduledInterventions.length} intervention(s) à planifier
                  </p>
                  <p className="text-sm text-amber-700">
                    Définissez une date pour ces interventions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === "calendar" ? (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-xl font-semibold min-w-[200px] text-center">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" onClick={handleToday}>
                  Aujourd'hui
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                {/* Header */}
                {DAYS.map(day => (
                  <div
                    key={day}
                    className="bg-muted/50 p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
                
                {/* Days */}
                {calendarDays.map((day, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className={`
                      min-h-[100px] p-2 bg-background cursor-pointer transition-colors
                      ${!day.isCurrentMonth ? "opacity-40" : ""}
                      ${isToday(day.date) ? "ring-2 ring-primary ring-inset" : ""}
                      hover:bg-muted/50
                    `}
                    onClick={() => {
                      setSelectedDate(day.date);
                      if (day.interventions.length === 1) {
                        setSelectedIntervention(day.interventions[0]);
                      }
                    }}
                  >
                    <div className={`
                      text-sm font-medium mb-1
                      ${isToday(day.date) ? "text-primary" : ""}
                    `}>
                      {day.date.getDate()}
                    </div>
                    
                    <div className="space-y-1">
                      {day.interventions.slice(0, 3).map(int => {
                        const priority = PRIORITY_CONFIG[int.priority];
                        return (
                          <div
                            key={int.id}
                            className={`
                              text-xs p-1 rounded truncate cursor-pointer
                              ${STATUS_CONFIG[int.status].bgColor}
                              ${STATUS_CONFIG[int.status].color}
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIntervention(int);
                            }}
                          >
                            {int.title}
                          </div>
                        );
                      })}
                      {day.interventions.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{day.interventions.length - 3} autres
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* List view */
          <Card>
            <CardHeader>
              <CardTitle>Liste des interventions</CardTitle>
              <CardDescription>
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {interventions.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">Aucune intervention ce mois-ci</p>
                  </div>
                ) : (
                  interventions.map(int => {
                    const status = STATUS_CONFIG[int.status];
                    const priority = PRIORITY_CONFIG[int.priority];
                    
                    return (
                      <div
                        key={int.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedIntervention(int)}
                      >
                        <div className={`p-2 rounded-lg ${status.bgColor}`}>
                          <Wrench className={`h-5 w-5 ${status.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{int.title}</h3>
                            <Badge className={priority.color}>{priority.label}</Badge>
                            <Badge className={status.bgColor + " " + status.color}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {int.property_address}, {int.property_city}
                          </p>
                          {int.scheduled_date && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" />
                              {new Date(int.scheduled_date).toLocaleDateString("fr-FR", {
                                weekday: "long",
                                day: "numeric",
                                month: "long"
                              })}
                            </p>
                          )}
                        </div>
                        {int.estimated_cost && (
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(int.estimated_cost)}</p>
                            <p className="text-xs text-muted-foreground">Estimé</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Intervention detail dialog */}
        <Dialog open={!!selectedIntervention} onOpenChange={() => setSelectedIntervention(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedIntervention?.title}</DialogTitle>
              <DialogDescription>
                Détails de l'intervention
              </DialogDescription>
            </DialogHeader>
            {selectedIntervention && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={PRIORITY_CONFIG[selectedIntervention.priority].color}>
                    {PRIORITY_CONFIG[selectedIntervention.priority].label}
                  </Badge>
                  <Badge className={
                    STATUS_CONFIG[selectedIntervention.status].bgColor + " " +
                    STATUS_CONFIG[selectedIntervention.status].color
                  }>
                    {STATUS_CONFIG[selectedIntervention.status].label}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedIntervention.property_address}, {selectedIntervention.property_city}</span>
                  </div>
                  {selectedIntervention.scheduled_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(selectedIntervention.scheduled_date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  )}
                  {selectedIntervention.estimated_cost && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Coût estimé:</span>
                      <span className="font-semibold">{formatCurrency(selectedIntervention.estimated_cost)}</span>
                    </div>
                  )}
                </div>

                {selectedIntervention.description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Description</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedIntervention.description}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {selectedIntervention.status === "assigned" && (
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        setSelectedIntervention(null);
                        toast({
                          title: "Planification",
                          description: "Utilisez la page Missions pour planifier l'intervention.",
                        });
                      }}
                    >
                      Planifier
                    </Button>
                  )}
                  {selectedIntervention.status === "scheduled" && (
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        setSelectedIntervention(null);
                        toast({
                          title: "Démarrage",
                          description: "Utilisez la page Missions pour démarrer l'intervention.",
                        });
                      }}
                    >
                      Commencer
                    </Button>
                  )}
                  {selectedIntervention.status === "in_progress" && (
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        setSelectedIntervention(null);
                        toast({
                          title: "Terminaison",
                          description: "Utilisez la page Missions pour terminer l'intervention.",
                        });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Terminer
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedIntervention(null);
                      window.location.href = "/app/provider/jobs";
                    }}
                  >
                    Voir le ticket
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}

