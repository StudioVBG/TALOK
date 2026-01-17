"use client";
// @ts-nocheck

import { useState } from "react";
import {
  Wrench,
  MapPin,
  Calendar,
  Phone,
  User,
  Euro,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  property_address: string;
  property_city: string;
  property_postal: string;
  requester_name: string;
  requester_phone: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  created_at: string;
}

interface Props {
  jobs: Job[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  assigned: { label: "À accepter", color: "bg-amber-100 text-amber-800" },
  scheduled: { label: "Planifié", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "En cours", color: "bg-purple-100 text-purple-800" },
  done: { label: "Terminé", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-800" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  basse: { label: "Basse", color: "bg-gray-100 text-gray-600" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600" },
  haute: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

type DialogType = "accept" | "reject" | "start" | "complete" | null;

export function VendorJobsClient({ jobs: initialJobs }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [jobs, setJobs] = useState(initialJobs);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [scheduledDate, setScheduledDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.property_address.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openDialog = (job: Job, type: DialogType) => {
    setSelectedJob(job);
    setDialogType(type);
    // Reset form states
    setScheduledDate("");
    setRejectReason("");
    setFinalCost(job.estimated_cost?.toString() || "");
    setCompletionNotes("");
  };

  const closeDialog = () => {
    setSelectedJob(null);
    setDialogType(null);
  };

  const handleAccept = async () => {
    if (!selectedJob) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/provider/jobs/${selectedJob.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          scheduled_date: scheduledDate || null,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'acceptation");
      }

      // Mettre à jour localement
      setJobs(jobs.map(j => 
        j.id === selectedJob.id 
          ? { ...j, status: "scheduled", scheduled_date: scheduledDate || null }
          : j
      ));

      toast({
        title: "Mission acceptée",
        description: scheduledDate 
          ? `Intervention prévue le ${new Date(scheduledDate).toLocaleDateString("fr-FR")}`
          : "Vous pouvez maintenant planifier l'intervention",
      });
      
      closeDialog();
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedJob) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/provider/jobs/${selectedJob.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          notes: rejectReason || "Non disponible",
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du refus");
      }

      // Mettre à jour localement
      setJobs(jobs.map(j => 
        j.id === selectedJob.id 
          ? { ...j, status: "cancelled" }
          : j
      ));

      toast({
        title: "Mission refusée",
        description: "Le propriétaire a été notifié",
      });
      
      closeDialog();
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedJob) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/provider/jobs/${selectedJob.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du démarrage");
      }

      // Mettre à jour localement
      setJobs(jobs.map(j => 
        j.id === selectedJob.id 
          ? { ...j, status: "in_progress" }
          : j
      ));

      toast({
        title: "Intervention démarrée",
        description: "Le propriétaire a été notifié du début de l'intervention.",
      });
      
      closeDialog();
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedJob) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/provider/jobs/${selectedJob.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          final_cost: finalCost ? parseFloat(finalCost) : null,
          notes: completionNotes || null,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la complétion");
      }

      // Mettre à jour localement
      setJobs(jobs.map(j => 
        j.id === selectedJob.id 
          ? { 
              ...j, 
              status: "done", 
              final_cost: finalCost ? parseFloat(finalCost) : null,
              completed_date: new Date().toISOString(),
            }
          : j
      ));

      toast({
        title: "Intervention terminée",
        description: "Le propriétaire a été notifié. N'oubliez pas d'envoyer votre facture.",
      });
      
      closeDialog();
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes missions</h1>
        <p className="text-muted-foreground">
          Gérez vos interventions et devis
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre ou adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "assigned", "scheduled", "in_progress", "done"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "Toutes" : statusConfig[status]?.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <Card key={job.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  {/* Main Content */}
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{job.title}</h3>
                          <Badge className={priorityConfig[job.priority]?.color}>
                            {priorityConfig[job.priority]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {job.description}
                        </p>
                      </div>
                      <Badge className={statusConfig[job.status]?.color}>
                        {statusConfig[job.status]?.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">
                          {job.property_address}, {job.property_postal} {job.property_city}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{job.requester_name}</span>
                      </div>
                      {job.requester_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a href={`tel:${job.requester_phone}`} className="text-primary hover:underline">
                            {job.requester_phone}
                          </a>
                        </div>
                      )}
                      {job.scheduled_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>
                            {new Date(job.scheduled_date).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      )}
                      {(job.estimated_cost || job.final_cost) && (
                        <div className="flex items-center gap-2">
                          <Euro className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>
                            {job.final_cost 
                              ? `Final: ${job.final_cost.toLocaleString("fr-FR")} €`
                              : `Estimé: ${job.estimated_cost?.toLocaleString("fr-FR")} €`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="bg-muted/30 p-4 flex flex-row md:flex-col gap-2 justify-end md:justify-center">
                    {job.status === "assigned" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openDialog(job, "accept")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Accepter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDialog(job, "reject")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </>
                    )}
                    {job.status === "scheduled" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openDialog(job, "start")}
                        >
                          <Wrench className="h-4 w-4 mr-1" />
                          Démarrer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push("/provider/quotes/new")}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Devis
                        </Button>
                      </>
                    )}
                    {job.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => openDialog(job, "complete")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Terminer
                      </Button>
                    )}
                    {job.status === "done" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push("/provider/invoices")}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Facturer
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Aucune mission</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? "Aucune mission avec ce statut"
                  : "Les nouvelles missions apparaîtront ici"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Accept Dialog */}
      <Dialog open={dialogType === "accept"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accepter la mission</DialogTitle>
            <DialogDescription>
              Confirmez que vous acceptez cette intervention. Vous pouvez optionnellement
              définir une date d'intervention prévisionnelle.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="font-semibold">{selectedJob.title}</p>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
                <p className="text-sm">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  {selectedJob.property_address}, {selectedJob.property_city}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Date d'intervention prévue (optionnel)</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleAccept} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Dialog */}
      <Dialog open={dialogType === "start"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Démarrer l'intervention</DialogTitle>
            <DialogDescription>
              Confirmez que vous commencez cette intervention. Le propriétaire sera notifié.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="font-semibold">{selectedJob.title}</p>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
                <p className="text-sm">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  {selectedJob.property_address}, {selectedJob.property_city}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleStart} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Démarrer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={dialogType === "reject"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la mission</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du refus. Le propriétaire sera notifié.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="font-semibold">{selectedJob.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedJob.property_address}, {selectedJob.property_city}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Raison du refus</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Ex: Non disponible sur cette période, hors zone d'intervention..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={dialogType === "complete"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminer l'intervention</DialogTitle>
            <DialogDescription>
              Marquez cette intervention comme terminée et indiquez le coût final.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="font-semibold">{selectedJob.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedJob.property_address}, {selectedJob.property_city}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="final-cost">Coût final (€)</Label>
                <Input
                  id="final-cost"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 150.00"
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                />
                {selectedJob.estimated_cost && (
                  <p className="text-xs text-muted-foreground">
                    Estimation initiale : {selectedJob.estimated_cost.toLocaleString("fr-FR")} €
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="completion-notes">Notes (optionnel)</Label>
                <Textarea
                  id="completion-notes"
                  placeholder="Détails sur l'intervention réalisée..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleComplete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Marquer comme terminé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
