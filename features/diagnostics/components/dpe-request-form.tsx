"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Key, 
  Plus, 
  Trash2,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { dpeService } from "../services/dpe.service";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface DpeRequestFormProps {
  property: {
    id: string;
    adresse_complete: string;
    type: string;
    surface?: number;
  };
}

interface TimeSlot {
  start: string;
  end: string;
}

export function DpeRequestForm({ property }: DpeRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    visit_contact_name: "",
    visit_contact_role: "OWNER" as "OWNER" | "TENANT" | "OTHER",
    visit_contact_email: "",
    visit_contact_phone: "",
    access_notes: "",
    notes: "",
  });

  const [slots, setSlots] = useState<TimeSlot[]>([{ start: "", end: "" }]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleRoleChange = (value: string) => {
    setFormData({ ...formData, visit_contact_role: value as "OWNER" | "TENANT" | "OTHER" });
  };

  const handleSlotChange = (index: number, field: "start" | "end", value: string) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };

  const addSlot = () => {
    if (slots.length < 3) {
      setSlots([...slots, { start: "", end: "" }]);
    }
  };

  const removeSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation simple
    if (!formData.visit_contact_name.trim()) {
      toast({ title: "Erreur", description: "Le nom du contact est requis", variant: "destructive" });
      return;
    }
    if (!formData.visit_contact_phone.trim() || formData.visit_contact_phone.length < 10) {
      toast({ title: "Erreur", description: "Téléphone invalide (min 10 caractères)", variant: "destructive" });
      return;
    }
    if (!slots[0].start || !slots[0].end) {
      toast({ title: "Erreur", description: "Au moins un créneau est requis", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dpeService.createRequest({
        property_id: property.id,
        visit_contact_name: formData.visit_contact_name,
        visit_contact_role: formData.visit_contact_role,
        visit_contact_email: formData.visit_contact_email || undefined,
        visit_contact_phone: formData.visit_contact_phone,
        access_notes: formData.access_notes || undefined,
        notes: formData.notes || undefined,
        preferred_slots: slots.filter(s => s.start && s.end),
      });
      setIsSuccess(true);
      toast({
        title: "Demande envoyée !",
        description: "Votre demande de DPE a été enregistrée avec succès.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'envoi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-emerald-100 bg-emerald-50/30">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="p-4 rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">Demande confirmée</h3>
            <p className="text-slate-600 max-w-md">
              Votre demande pour le logement au <strong>{property.adresse_complete}</strong> a été transmise. Un diagnostiqueur vous contactera prochainement pour confirmer l&apos;un de vos créneaux.
            </p>
          </div>
          <Button onClick={() => router.push(`/owner/properties/${property.id}/diagnostics`)} className="bg-emerald-600 hover:bg-emerald-700">
            Retour aux diagnostics
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section Contact */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Contact pour la visite
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Qui est présent ?</Label>
              <Select value={formData.visit_contact_role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Propriétaire (Moi)</SelectItem>
                  <SelectItem value="TENANT">Locataire</SelectItem>
                  <SelectItem value="OTHER">Autre (Gardien, mandataire...)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input 
                placeholder="Ex: Jean Dupont" 
                value={formData.visit_contact_name}
                onChange={handleChange("visit_contact_name")}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9" 
                    placeholder="06..." 
                    value={formData.visit_contact_phone}
                    onChange={handleChange("visit_contact_phone")}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (optionnel)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9" 
                    placeholder="jean@email.com" 
                    type="email"
                    value={formData.visit_contact_email}
                    onChange={handleChange("visit_contact_email")}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Accès & Créneaux */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Créneaux souhaités *
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                {slots.map((slot, index) => (
                  <div key={index} className="flex items-end gap-2 p-3 border rounded-lg bg-slate-50/50">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Début</Label>
                          <Input 
                            type="datetime-local" 
                            value={slot.start}
                            onChange={(e) => handleSlotChange(index, "start", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Fin</Label>
                          <Input 
                            type="datetime-local" 
                            value={slot.end}
                            onChange={(e) => handleSlotChange(index, "end", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    {slots.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeSlot(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {slots.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addSlot}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un créneau
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-600" />
                Accès & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Codes d&apos;accès / Consignes clés</Label>
                <Input 
                  placeholder="Digicode, étage, emplacement clés..." 
                  value={formData.access_notes}
                  onChange={handleChange("access_notes")}
                />
              </div>
              <div className="space-y-2">
                <Label>Précisions complémentaires</Label>
                <Textarea 
                  placeholder="Plans disponibles, factures travaux récents, points d'attention..." 
                  className="min-h-[100px]"
                  value={formData.notes}
                  onChange={handleChange("notes")}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-4 border-t">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 min-w-[200px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            "Envoyer la demande"
          )}
        </Button>
      </div>
    </form>
  );
}
