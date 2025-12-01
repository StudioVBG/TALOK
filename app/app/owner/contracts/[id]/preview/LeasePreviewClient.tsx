"use client";
// @ts-nocheck

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Download,
  Printer,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  User,
  Euro,
  Calendar,
  Shield,
  Scale,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import type { LeaseDetails } from "../../../_data/fetchLeaseDetails";

interface LeasePreviewClientProps {
  details: LeaseDetails;
  leaseId: string;
  ownerProfile: {
    id: string;
    prenom: string;
    nom: string;
  };
}

// Labels pour les types de bail
const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
};

// Statuts avec couleurs
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Edit },
  pending_signature: { label: "En attente de signature", color: "bg-amber-100 text-amber-700", icon: Clock },
  pending_owner_signature: { label: "Attente signature propriétaire", color: "bg-blue-100 text-blue-700", icon: Clock },
  active: { label: "Actif", color: "bg-green-100 text-green-700", icon: CheckCircle },
  terminated: { label: "Terminé", color: "bg-slate-100 text-slate-600", icon: AlertTriangle },
};

export function LeasePreviewClient({ details, leaseId, ownerProfile }: LeasePreviewClientProps) {
  const { lease, property, signers } = details;
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Fonction d'impression native
  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    
    // Créer une nouvelle fenêtre pour l'impression
    const printContent = printRef.current?.innerHTML;
    if (!printContent) {
      setIsPrinting(false);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bail - ${property.adresse_complete} - ${lease.date_debut}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; }
            .print-container { max-width: 800px; margin: 0 auto; padding: 40px; }
            h2, h3, h4 { color: #0f172a; margin-bottom: 1rem; }
            .section { margin-bottom: 2rem; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
            .text-center { text-align: center; }
            .text-muted { color: #64748b; font-size: 0.875rem; }
            .font-bold { font-weight: 700; }
            .text-2xl { font-size: 1.5rem; }
            .mt-4 { margin-top: 1rem; }
            .mb-4 { margin-bottom: 1rem; }
            .p-4 { padding: 1rem; }
            .bg-slate { background-color: #f8fafc; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${printContent}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
    };
  }, [property.adresse_complete, lease.date_debut]);

  // Fonction de téléchargement PDF
  const handleDownloadPDF = useCallback(async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/pdf`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération du PDF");
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bail_${lease.type_bail}_${property.ville || "location"}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "✅ PDF téléchargé",
        description: "Le bail a été téléchargé avec succès.",
      });
    } catch (error: any) {
      console.error("Erreur téléchargement PDF:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de télécharger le PDF. Utilisez l'impression pour sauvegarder en PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [leaseId, lease.type_bail, property.ville, toast]);

  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  // Calculer le loyer total
  const loyerTotal = Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 hover:bg-transparent">
            <Link href={`/app/owner/contracts/${leaseId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux détails
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  Aperçu du bail
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={statusConfig.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {LEASE_TYPE_LABELS[lease.type_bail] || lease.type_bail}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {lease.statut === "draft" && (
                <Button variant="outline" asChild>
                  <Link href={`/app/owner/contracts/${leaseId}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handlePrint()}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Imprimer
              </Button>
              <Button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="bg-gradient-to-r from-green-600 to-emerald-600"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="preview" className="space-y-6">
          <TabsList className="bg-white/50 backdrop-blur-sm border">
            <TabsTrigger value="preview">Aperçu complet</TabsTrigger>
            <TabsTrigger value="clauses">Clauses légales</TabsTrigger>
            <TabsTrigger value="signatures">Signatures</TabsTrigger>
          </TabsList>

          {/* Onglet Aperçu */}
          <TabsContent value="preview">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              ref={printRef}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden print:shadow-none print:border-none"
            >
              {/* En-tête du document */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8 print:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      CONTRAT DE {LEASE_TYPE_LABELS[lease.type_bail]?.toUpperCase() || "LOCATION"}
                    </h2>
                    <p className="text-slate-300 mt-1">
                      Conforme à la loi ALUR du 24 mars 2014
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Référence</p>
                    <p className="font-mono text-lg">{leaseId.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Contenu du bail */}
              <div className="p-8 space-y-8">
                {/* Parties au contrat */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    ENTRE LES SOUSSIGNÉS
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Bailleur */}
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-600">LE BAILLEUR</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-semibold text-lg">
                          {ownerProfile.prenom} {ownerProfile.nom}
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                          Ci-après dénommé "le Bailleur"
                        </p>
                      </CardContent>
                    </Card>

                    {/* Locataire */}
                    <Card className="border-green-200 dark:border-green-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-600">LE LOCATAIRE</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {signers.filter(s => s.role === "locataire_principal").length > 0 ? (
                          signers.filter(s => s.role === "locataire_principal").map((signer: any) => (
                            <div key={signer.id}>
                              <p className="font-semibold text-lg">
                                {signer.profile?.prenom} {signer.profile?.nom}
                              </p>
                              <p className="text-muted-foreground text-sm mt-1">
                                Ci-après dénommé "le Locataire"
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-amber-600 italic">
                            En attente d'invitation du locataire
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <Separator />

                {/* Description du logement */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    DÉSIGNATION DU LOGEMENT
                  </h3>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Adresse complète</p>
                          <p className="font-medium">{property.adresse_complete}</p>
                          <p className="text-muted-foreground">
                            {property.code_postal} {property.ville}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Type de logement</p>
                          <p className="font-medium capitalize">{property.type || "Non spécifié"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <Separator />

                {/* Conditions financières */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Euro className="h-5 w-5 text-blue-600" />
                    CONDITIONS FINANCIÈRES
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-blue-600 font-medium">Loyer mensuel HC</p>
                        <p className="text-3xl font-bold text-blue-700 mt-2">
                          {formatCurrency(Number(lease.loyer || 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-green-600 font-medium">Charges forfaitaires</p>
                        <p className="text-3xl font-bold text-green-700 mt-2">
                          {formatCurrency(Number(lease.charges_forfaitaires || 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30 border-purple-200">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-purple-600 font-medium">Dépôt de garantie</p>
                        <p className="text-3xl font-bold text-purple-700 mt-2">
                          {formatCurrency(Number(lease.depot_de_garantie || 0))}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total mensuel (loyer + charges)</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(loyerTotal)}/mois
                      </span>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Durée du bail */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    DURÉE DU CONTRAT
                  </h3>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground">Date de prise d'effet</p>
                          <p className="text-xl font-semibold">{formatDate(lease.date_debut)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Date de fin</p>
                          <p className="text-xl font-semibold">
                            {lease.date_fin ? formatDate(lease.date_fin) : "Durée indéterminée"}
                          </p>
                        </div>
                      </div>
                      
                      {lease.type_bail === "meuble" && (
                        <p className="mt-4 text-sm text-muted-foreground">
                          Conformément à l'article 25-7 de la loi du 6 juillet 1989, ce bail est conclu 
                          pour une durée d'un an renouvelable par tacite reconduction.
                        </p>
                      )}
                      {lease.type_bail === "nu" && (
                        <p className="mt-4 text-sm text-muted-foreground">
                          Conformément à l'article 10 de la loi du 6 juillet 1989, ce bail est conclu 
                          pour une durée de trois ans renouvelable par tacite reconduction.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>

                <Separator />

                {/* Pied de page */}
                <div className="text-center text-sm text-muted-foreground pt-4">
                  <p>
                    Fait en deux exemplaires originaux, dont un pour chaque partie.
                  </p>
                  <p className="mt-2">
                    Document généré le {formatDate(new Date().toISOString())}
                  </p>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Onglet Clauses légales */}
          <TabsContent value="clauses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Clauses légales obligatoires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Article 1 - Objet du contrat</h4>
                  <p className="text-sm text-muted-foreground">
                    Le présent contrat a pour objet la location du logement décrit ci-dessus, 
                    à usage d'habitation principale du locataire.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Article 2 - Durée du contrat</h4>
                  <p className="text-sm text-muted-foreground">
                    {lease.type_bail === "meuble" 
                      ? "Le présent contrat est conclu pour une durée d'un (1) an, renouvelable par tacite reconduction, sauf congé délivré dans les conditions légales."
                      : "Le présent contrat est conclu pour une durée de trois (3) ans, renouvelable par tacite reconduction, sauf congé délivré dans les conditions légales."
                    }
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Article 3 - Paiement du loyer</h4>
                  <p className="text-sm text-muted-foreground">
                    Le loyer est payable mensuellement et d'avance, le premier jour de chaque mois.
                    Tout retard de paiement pourra donner lieu à des pénalités conformément à la loi.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Article 4 - Charges et conditions</h4>
                  <p className="text-sm text-muted-foreground">
                    Les charges sont calculées selon un forfait mensuel de {formatCurrency(Number(lease.charges_forfaitaires || 0))}.
                    Aucune régularisation annuelle ne sera effectuée.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Article 5 - Dépôt de garantie</h4>
                  <p className="text-sm text-muted-foreground">
                    Un dépôt de garantie de {formatCurrency(Number(lease.depot_de_garantie || 0))} est versé 
                    à la signature du bail. Il sera restitué dans un délai maximum de deux mois 
                    après la remise des clés, déduction faite des sommes restant dues au bailleur.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Ce contrat est conforme à la loi n°89-462 du 6 juillet 1989 modifiée par la loi ALUR.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Signatures */}
          <TabsContent value="signatures">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  État des signatures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Propriétaire */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{ownerProfile.prenom} {ownerProfile.nom}</p>
                        <p className="text-sm text-muted-foreground">Bailleur</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente
                    </Badge>
                  </div>

                  {/* Locataires */}
                  {signers.filter(s => s.role !== "proprietaire").length > 0 ? (
                    signers.filter(s => s.role !== "proprietaire").map((signer: any) => (
                      <div key={signer.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                            <User className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {signer.profile?.prenom} {signer.profile?.nom}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {signer.role.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            signer.signature_status === "signed" 
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {signer.signature_status === "signed" ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Signé le {formatDateShort(signer.signed_at)}
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              En attente
                            </>
                          )}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                      <p className="text-amber-700 dark:text-amber-300">
                        Aucun locataire n'a encore été invité à signer ce bail.
                      </p>
                    </div>
                  )}
                </div>

                {lease.statut === "draft" && (
                  <div className="mt-6">
                    <Button className="w-full" asChild>
                      <Link href={`/app/owner/contracts/${leaseId}`}>
                        Envoyer les invitations de signature
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

