"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Phone, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock,
  Camera,
  Euro,
  FileText
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";

interface JobDetailProps {
  job: any;
}

export function JobDetailClient({ job }: JobDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [completionData, setCompletionData] = useState({
    finalCost: job.estimated_cost || "",
    notes: "",
  });

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          statut: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `La mission est maintenant ${getStatusLabel(newStatus).toLowerCase()}.`,
        variant: "default",
      });
      
      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    setLoading(true);
    try {
      // 1. Mettre à jour le work_order
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          statut: "done",
          cout_final: parseFloat(completionData.finalCost) || 0,
          provider_notes: completionData.notes,
          date_intervention_reelle: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      if (error) throw error;

      // 2. Mettre à jour le ticket parent en 'resolved'
      if (job.ticket_id) {
         await supabase
          .from("tickets")
          .update({ statut: "resolved" })
          .eq("id", job.ticket_id);
      }

      toast({
        title: "Mission terminée !",
        description: "Le rapport a été envoyé au propriétaire.",
        variant: "default",
      });
      
      router.refresh();
    } catch (error) {
      console.error("Error completing job:", error);
      toast({
        title: "Erreur",
        description: "Impossible de terminer la mission.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "assigned": return "En attente";
      case "scheduled": return "Planifié";
      case "in_progress": return "En cours";
      case "done": return "Terminé";
      case "cancelled": return "Annulé";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "scheduled": return "bg-blue-100 text-blue-800 border-blue-200";
      case "in_progress": return "bg-purple-100 text-purple-800 border-purple-200";
      case "done": return "bg-green-100 text-green-800 border-green-200";
      case "cancelled": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4 pl-0 hover:bg-transparent hover:text-blue-600">
          <Link href="/provider/jobs" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux missions
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{job.title}</h1>
              <Badge className={getStatusColor(job.status)} variant="outline">
                {getStatusLabel(job.status)}
              </Badge>
            </div>
            <p className="text-slate-500 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {job.property.address}, {job.property.postalCode} {job.property.city}
            </p>
          </div>

          <div className="flex gap-2">
            {job.status === "assigned" && (
              <>
                <Button 
                  variant="outline" 
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={loading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Refuser
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStatusChange("scheduled")}
                  disabled={loading}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accepter
                </Button>
              </>
            )}

            {job.status === "scheduled" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Terminer l'intervention
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rapport d'intervention</DialogTitle>
                    <CardDescription>
                      Confirmez les détails finaux pour clôturer ce dossier.
                    </CardDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="final-cost">Coût Final (€)</Label>
                      <Input 
                        id="final-cost" 
                        type="number" 
                        value={completionData.finalCost}
                        onChange={(e) => setCompletionData({...completionData, finalCost: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes d'intervention</Label>
                      <Textarea 
                        id="notes" 
                        placeholder="Détails sur la réparation effectuée..."
                        value={completionData.notes}
                        onChange={(e) => setCompletionData({...completionData, notes: e.target.value})}
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
                      <Camera className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-500">Ajouter des photos (Bientôt disponible)</p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={handleCompleteJob} disabled={loading}>
                      {loading ? "Enregistrement..." : "Confirmer et Clôturer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description du problème</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détails financiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Coût estimé</p>
                    <p className="text-xl font-semibold">{job.estimated_cost ? `${job.estimated_cost} €` : "Non défini"}</p>
                 </div>
                 <div className={`p-4 rounded-lg ${job.final_cost ? "bg-green-50 text-green-900" : "bg-slate-50"}`}>
                    <p className="text-sm opacity-70 mb-1">Coût final</p>
                    <p className="text-xl font-semibold">{job.final_cost ? `${job.final_cost} €` : "-"}</p>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Propriétaire</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{job.owner.name}</p>
                    {job.owner.phone && <p className="text-xs text-slate-500">{job.owner.phone}</p>}
                  </div>
                </div>
              </div>
              
              <Separator />

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Locataire (Sur place)</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{job.tenant.name}</p>
                    {job.tenant.phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <a href={`tel:${job.tenant.phone}`} className="text-xs text-blue-600 hover:underline">
                          {job.tenant.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div>
                 <p className="text-xs text-slate-500 mb-1">Date souhaitée</p>
                 <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-slate-400" />
                   <span className="text-sm">
                     {job.scheduled_date ? format(new Date(job.scheduled_date), "d MMMM yyyy", { locale: fr }) : "À définir"}
                   </span>
                 </div>
               </div>
               
               {job.completed_date && (
                 <div>
                   <p className="text-xs text-slate-500 mb-1">Réalisé le</p>
                   <div className="flex items-center gap-2 text-green-700">
                     <CheckCircle className="h-4 w-4" />
                     <span className="text-sm font-medium">
                       {format(new Date(job.completed_date), "d MMMM yyyy", { locale: fr })}
                     </span>
                   </div>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
