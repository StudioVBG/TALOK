"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  FileUp, 
  Calendar, 
  Hash, 
  Loader2,
  CheckCircle2
} from "lucide-react";
import { dpeService } from "../services/dpe.service";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface DpeUploadFormProps {
  propertyId: string;
  requestId?: string;
}

type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export function DpeUploadForm({ propertyId, requestId }: DpeUploadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    dpe_number: "",
    issued_at: "",
    energy_class: "D" as EnergyClass,
    ges_class: "D" as EnergyClass,
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Format invalide",
          description: "Seuls les fichiers PDF sont acceptés.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "Fichier manquant",
        description: "Veuillez sélectionner le rapport PDF du DPE.",
        variant: "destructive",
      });
      return;
    }

    // Validation du numéro ADEME (13 chiffres)
    if (!/^[0-9]{13}$/.test(formData.dpe_number)) {
      toast({
        title: "Numéro invalide",
        description: "Le numéro ADEME doit contenir exactement 13 chiffres.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.issued_at) {
      toast({
        title: "Date manquante",
        description: "La date d'établissement est requise.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await dpeService.uploadDeliverable({
        property_id: propertyId,
        request_id: requestId,
        dpe_number: formData.dpe_number,
        issued_at: formData.issued_at,
        energy_class: formData.energy_class,
        ges_class: formData.ges_class,
        source: "UPLOAD",
      }, file);
      setIsSuccess(true);
      toast({
        title: "DPE importé !",
        description: "Le diagnostic a été enregistré et validé avec succès.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'import.",
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
            <h3 className="text-xl font-bold text-slate-900">DPE Enregistré</h3>
            <p className="text-slate-600 max-w-md">
              Les données ont été extraites et la validité a été calculée automatiquement. Le logement est désormais à jour.
            </p>
          </div>
          <Button onClick={() => router.push(`/owner/properties/${propertyId}/diagnostics`)} className="bg-emerald-600 hover:bg-emerald-700">
            Voir le statut DPE
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section Document */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <FileUp className="h-4 w-4 text-blue-600" />
              Fichier du rapport
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Rapport PDF officiel *</Label>
              <div className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${file ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'}
              `}>
                <input
                  type="file"
                  id="dpe-file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
                <label htmlFor="dpe-file" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className={`p-3 rounded-full ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <FileUp className="h-6 w-6" />
                  </div>
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                      <p className="text-xs text-emerald-600/70">Cliquer pour changer de fichier</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Sélectionner le PDF</p>
                      <p className="text-xs text-muted-foreground">PDF uniquement, max 10 Mo</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date d&apos;établissement *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  className="pl-9" 
                  value={formData.issued_at}
                  onChange={handleChange("issued_at")}
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Sert au calcul automatique de la date de fin de validité.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section Métadonnées */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-600" />
              Informations Clés
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Numéro ADEME (13 chiffres) *</Label>
              <Input 
                placeholder="Ex: 2192E1234567A" 
                value={formData.dpe_number}
                onChange={handleChange("dpe_number")}
                maxLength={13}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classe Énergie *</Label>
                <Select 
                  value={formData.energy_class} 
                  onValueChange={(v) => setFormData({ ...formData, energy_class: v as EnergyClass })}
                >
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="A-G" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["A", "B", "C", "D", "E", "F", "G"] as EnergyClass[]).map(letter => (
                      <SelectItem key={letter} value={letter} className="font-bold">
                        Logement {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Classe GES</Label>
                <Select 
                  value={formData.ges_class} 
                  onValueChange={(v) => setFormData({ ...formData, ges_class: v as EnergyClass })}
                >
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="A-G" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["A", "B", "C", "D", "E", "F", "G"] as EnergyClass[]).map(letter => (
                      <SelectItem key={letter} value={letter} className="font-bold">
                        Classe {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
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
              Importation...
            </>
          ) : (
            "Valider et Enregistrer"
          )}
        </Button>
      </div>
    </form>
  );
}
