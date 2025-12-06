"use client";
// @ts-nocheck

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  CheckCircle, 
  Clock, 
  User, 
  Trash2, 
  Loader2,
  Download,
  Printer,
  Building2,
  Euro,
  Shield,
  Edit,
  Users,
  FolderOpen,
  CreditCard,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers/format";
import type { LeaseDetails } from "../../_data/fetchLeaseDetails";
import { useToast } from "@/components/ui/use-toast";

interface LeaseDetailsClientProps {
  details: LeaseDetails;
  leaseId: string;
  ownerProfile?: {
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

// Config des statuts
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700 border-slate-300" },
  pending_signature: { label: "Signature en attente", color: "bg-amber-100 text-amber-700 border-amber-300" },
  pending_owner_signature: { label: "À signer (propriétaire)", color: "bg-blue-100 text-blue-700 border-blue-300" },
  active: { label: "Actif", color: "bg-green-100 text-green-700 border-green-300" },
  terminated: { label: "Terminé", color: "bg-slate-100 text-slate-600 border-slate-300" },
};

export function LeaseDetailsClient({ details, leaseId, ownerProfile }: LeaseDetailsClientProps) {
  const { lease, property, signers, payments, documents } = details;
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Calculer le loyer total
  const loyerTotal = Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0);
  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;

  // Trouver le locataire principal et le signataire propriétaire
  const mainTenant = signers?.find((s: any) => s.role === "locataire_principal");
  const ownerSigner = signers?.find((s: any) => s.role === "proprietaire");
  
  // Vérifier si le propriétaire doit signer
  const needsOwnerSignature = (
    lease.statut === "pending_owner_signature" || 
    (lease.statut === "pending_signature" && mainTenant?.signature_status === "signed" && ownerSigner?.signature_status !== "signed")
  );

  // Signer le bail en tant que propriétaire
  const handleOwnerSign = async () => {
    setIsSigning(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "SES", // Signature électronique simple
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la signature");
      }
      toast({
        title: "✅ Bail signé !",
        description: "Le bail est maintenant actif.",
      });
      router.refresh();
    } catch (error: any) {
      console.error("Erreur signature:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de signer le bail",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  // Supprimer le bail
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }
      toast({
        title: "✅ Bail supprimé",
        description: "Le bail et toutes ses données ont été supprimés.",
      });
      router.push("/app/owner/contracts");
      router.refresh();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le bail",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Fonction d'impression
  const handlePrint = useCallback(() => {
    setIsPrinting(true);
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
          <title>Bail - ${property.adresse_complete}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; color: #1e293b; line-height: 1.6; font-size: 11pt; }
            .container { max-width: 210mm; margin: 0 auto; padding: 20mm; }
            h1 { font-size: 18pt; text-align: center; margin-bottom: 5mm; }
            h2 { font-size: 14pt; margin: 8mm 0 4mm; border-bottom: 1px solid #000; padding-bottom: 2mm; }
            h3 { font-size: 12pt; margin: 5mm 0 3mm; }
            .header { text-align: center; margin-bottom: 10mm; border-bottom: 2px solid #000; padding-bottom: 5mm; }
            .reference { font-size: 10pt; color: #666; }
            .parties { display: flex; gap: 10mm; margin: 5mm 0; }
            .party { flex: 1; border: 1px solid #ccc; padding: 5mm; }
            .party-title { font-weight: bold; font-size: 10pt; color: #0066cc; margin-bottom: 2mm; }
            .section { margin: 8mm 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
            .field { margin: 3mm 0; }
            .field-label { font-size: 9pt; color: #666; }
            .field-value { font-weight: 500; }
            .amount { font-size: 14pt; font-weight: bold; }
            .total-box { background: #f5f5f5; padding: 5mm; margin: 5mm 0; display: flex; justify-content: space-between; }
            .legal { font-size: 9pt; color: #666; margin-top: 5mm; }
            .footer { text-align: center; margin-top: 15mm; font-size: 9pt; color: #666; }
            .signature-area { display: flex; gap: 20mm; margin-top: 20mm; }
            .signature-box { flex: 1; border-top: 1px solid #000; padding-top: 3mm; text-align: center; }
            @media print { 
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <div class="container">
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
  }, [property.adresse_complete]);

  // Téléchargement PDF
  const handleDownloadPDF = useCallback(async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/pdf`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération du PDF");
      }
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
        description: error.message || "Utilisez l'impression pour sauvegarder en PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [leaseId, lease.type_bail, property.ville, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        
        {/* Header compact */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/app/owner/contracts">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour à la liste
            </Link>
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {LEASE_TYPE_LABELS[lease.type_bail] || "Contrat de location"}
                </h1>
                <Badge className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {property.adresse_complete}, {property.code_postal} {property.ville}
              </p>
            </div>
            
            {/* Actions principales */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isPrinting}
              >
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                Imprimer
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Télécharger PDF
              </Button>
              
              {/* Bouton de signature propriétaire */}
              {needsOwnerSignature && (
                <Button
                  size="sm"
                  onClick={handleOwnerSign}
                  disabled={isSigning}
                  className="bg-blue-600 hover:bg-blue-700 animate-pulse"
                >
                  {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Signer le bail
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Aperçu du contrat (document imprimable) */}
        <div 
          ref={printRef}
          className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-6"
        >
          {/* En-tête du document */}
          <div className="header bg-slate-900 text-white p-6 text-center">
            <h1 className="text-xl font-bold tracking-wide">
              CONTRAT DE {LEASE_TYPE_LABELS[lease.type_bail]?.toUpperCase() || "LOCATION"}
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Conforme à la loi n°89-462 du 6 juillet 1989 modifiée par la loi ALUR
            </p>
            <p className="reference text-slate-400 text-xs mt-2">
              Référence : {leaseId.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            
            {/* Section 1: Les parties */}
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <User className="h-4 w-4 text-blue-600" />
                I. DÉSIGNATION DES PARTIES
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Le Bailleur</p>
                  <p className="font-semibold text-lg">
                    {ownerProfile?.prenom || "Propriétaire"} {ownerProfile?.nom || ""}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ci-après dénommé "le Bailleur"
                  </p>
                </div>
                
                <div className="border rounded-lg p-4 bg-green-50/50">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Le Locataire</p>
                  {mainTenant ? (
                    <>
                      <p className="font-semibold text-lg">
                        {mainTenant.profile?.prenom} {mainTenant.profile?.nom}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ci-après dénommé "le Locataire"
                      </p>
                    </>
                  ) : (
                    <p className="text-amber-600 italic">
                      En attente d'invitation du locataire
                    </p>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* Section 2: Le logement */}
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                II. DÉSIGNATION DU LOGEMENT
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Adresse</p>
                  <p className="font-medium">{property.adresse_complete}</p>
                  <p className="text-muted-foreground">{property.code_postal} {property.ville}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Type</p>
                  <p className="font-medium capitalize">{property.type || "Appartement"}</p>
                </div>
              </div>
            </section>

            <Separator />

            {/* Section 3: Conditions financières */}
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <Euro className="h-4 w-4 text-blue-600" />
                III. CONDITIONS FINANCIÈRES
              </h2>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium uppercase">Loyer HC</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {formatCurrency(Number(lease.loyer || 0))}
                  </p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium uppercase">Charges</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {formatCurrency(Number(lease.charges_forfaitaires || 0))}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-xs text-purple-600 font-medium uppercase">Dépôt de garantie</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {formatCurrency(Number(lease.depot_de_garantie || 0))}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-100 rounded-lg">
                <span className="font-medium">Total mensuel (loyer + charges)</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(loyerTotal)} /mois
                </span>
              </div>
            </section>

            <Separator />

            {/* Section 4: Durée */}
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                IV. DURÉE DU CONTRAT
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Date d'effet</p>
                  <p className="text-lg font-semibold">{formatDate(lease.date_debut)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Date de fin</p>
                  <p className="text-lg font-semibold">
                    {lease.date_fin ? formatDate(lease.date_fin) : "Durée indéterminée"}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">
                {lease.type_bail === "meuble" 
                  ? "Conformément à l'article 25-7 de la loi du 6 juillet 1989, ce bail est conclu pour une durée d'un an renouvelable par tacite reconduction."
                  : "Conformément à l'article 10 de la loi du 6 juillet 1989, ce bail est conclu pour une durée de trois ans renouvelable par tacite reconduction."
                }
              </p>
            </section>

            <Separator />

            {/* Signatures */}
            <section className="pt-4">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-8">Le Bailleur</p>
                  <div className="border-t border-slate-300 pt-2">
                    <p className="text-sm font-medium">
                      {ownerProfile?.prenom} {ownerProfile?.nom}
                    </p>
                    {signers?.find((s: any) => s.role === "proprietaire")?.signature_status === "signed" ? (
                      <Badge className="mt-1 bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" /> Signé
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1">
                        <Clock className="h-3 w-3 mr-1" /> En attente
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-8">Le Locataire</p>
                  <div className="border-t border-slate-300 pt-2">
                    {mainTenant ? (
                      <>
                        <p className="text-sm font-medium">
                          {mainTenant.profile?.prenom} {mainTenant.profile?.nom}
                        </p>
                        {mainTenant.signature_status === "signed" ? (
                          <Badge className="mt-1 bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" /> Signé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1">
                            <Clock className="h-3 w-3 mr-1" /> En attente
                          </Badge>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-600 italic">En attente</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Pied de page */}
            <div className="text-center text-xs text-muted-foreground pt-6 border-t mt-6">
              <p>Fait en deux exemplaires originaux, dont un pour chaque partie.</p>
              <p className="mt-1">Document généré le {formatDate(new Date().toISOString())}</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-blue-600">
                <Shield className="h-3 w-3" />
                <span>Conforme à la loi ALUR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions de gestion (en bas) */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Gestion du bail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/owner/contracts/${leaseId}/edit`}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/owner/documents?lease_id=${leaseId}`}>
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Documents ({documents?.length || 0})
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/owner/money?lease_id=${leaseId}`}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Paiements ({payments?.length || 0})
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/owner/contracts/${leaseId}/signers`}>
                  <Users className="h-4 w-4 mr-1" />
                  Signataires ({signers?.length || 0})
                </Link>
              </Button>
              {/* Bouton colocataires - visible uniquement pour les colocations */}
              {lease.type_bail === "colocation" && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/owner/contracts/${leaseId}/roommates`}>
                    <Users className="h-4 w-4 mr-1" />
                    Colocataires
                  </Link>
                </Button>
              )}
              
              {/* Supprimer */}
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">
                      Supprimer ce bail ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Toutes les données associées seront supprimées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
