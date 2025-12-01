"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, FileText, Calendar, CheckCircle, Clock, XCircle, User, Wallet, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import type { LeaseDetails } from "../../_data/fetchLeaseDetails";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

interface LeaseDetailsClientProps {
  details: LeaseDetails;
  leaseId: string;
}

export function LeaseDetailsClient({ details, leaseId }: LeaseDetailsClientProps) {
  const { lease, property, signers, payments, documents } = details;
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

      // Rediriger vers la liste des baux
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending_signature: "secondary",
      terminated: "outline",
      draft: "outline",
    };
    const labels: Record<string, string> = {
      active: "En cours",
      pending_signature: "Signature en attente",
      terminated: "Terminé",
      draft: "Brouillon",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getSignatureStatusIcon = (status: string) => {
    switch (status) {
      case "signed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "refused":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
          <Link href="/app/owner/contracts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Bail {lease.type_bail || "Location"}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-3 ml-1">
              <Link href={`/app/owner/properties/${property.id}`} className="hover:underline text-muted-foreground text-sm flex items-center">
                 {property.adresse_complete}, {property.code_postal} {property.ville}
              </Link>
              <span className="text-slate-300">|</span>
              {getStatusBadge(lease.statut)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
               <Link href={`/app/owner/documents?lease_id=${leaseId}`}>
                 Documents
               </Link>
            </Button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800">
              Modifier le bail
            </Button>
            
            {/* Bouton Supprimer avec confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="h-5 w-5" />
                    Supprimer ce bail ?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <span className="block">
                        Vous êtes sur le point de supprimer le bail pour le logement :
                      </span>
                      <span className="block font-medium text-slate-900">
                        {property.adresse_complete}, {property.code_postal} {property.ville}
                      </span>
                      <span className="block text-red-600 font-medium mt-4">
                        ⚠️ Cette action est irréversible !
                      </span>
                      <span className="block text-sm">
                        Toutes les données associées seront supprimées : signataires, paiements, documents...
                      </span>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer définitivement
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Résumé financier et dates */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Loyer mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dont charges : {formatCurrency(Number(lease.charges_forfaitaires || 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépôt de garantie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(Number(lease.depot_de_garantie || 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reçu à la signature
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Début du bail</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2">
                 <Calendar className="h-5 w-5 text-slate-400" />
                 <p className="text-lg font-semibold">{formatDateShort(lease.date_debut)}</p>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Fin du bail</CardTitle>
          </CardHeader>
           <CardContent>
             <div className="flex items-center gap-2">
                 <Calendar className="h-5 w-5 text-slate-400" />
                 <p className="text-lg font-semibold">{lease.date_fin ? formatDateShort(lease.date_fin) : "Indéterminée"}</p>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="tenants" className="space-y-6">
        <TabsList className="w-full justify-start h-auto p-1 bg-slate-100/50 backdrop-blur-sm">
          <TabsTrigger value="tenants" className="px-4 py-2">Locataires & Garants</TabsTrigger>
          <TabsTrigger value="payments" className="px-4 py-2">Paiements</TabsTrigger>
          <TabsTrigger value="documents" className="px-4 py-2">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="details" className="px-4 py-2">Détails & Clauses</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <div className="grid gap-6 md:grid-cols-2">
             <Card>
               <CardHeader>
                 <CardTitle>Signataires</CardTitle>
                 <CardDescription>Personnes liées à ce contrat</CardDescription>
               </CardHeader>
               <CardContent>
                 {signers && signers.length > 0 ? (
                    <div className="space-y-4">
                      {signers.map((signer: any) => (
                        <div key={signer.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                           <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={signer.profile.avatar_url} />
                                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{signer.profile.prenom} {signer.profile.nom}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">{signer.role.replace('_', ' ')}</Badge>
                                  <span className="text-xs text-muted-foreground">{signer.profile.email}</span>
                                </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-2" title={`Signature: ${signer.signature_status}`}>
                              {getSignatureStatusIcon(signer.signature_status)}
                              {signer.signed_at && <span className="text-xs text-muted-foreground">{formatDateShort(signer.signed_at)}</span>}
                           </div>
                        </div>
                      ))}
                    </div>
                 ) : (
                   <p className="text-muted-foreground text-sm italic">Aucun signataire enregistré.</p>
                 )}
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Informations de contact</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-sm text-muted-foreground">Sélectionnez un locataire pour voir ses coordonnées complètes.</p>
               </CardContent>
             </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Historique des paiements</CardTitle>
              <CardDescription>Les 12 derniers paiements reçus</CardDescription>
            </CardHeader>
            <CardContent>
               {payments && payments.length > 0 ? (
                 <div className="space-y-2">
                   {payments.map((payment: any) => (
                     <div key={payment.id} className="flex items-center justify-between p-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-green-100 rounded-full text-green-700">
                             <Wallet className="h-4 w-4" />
                           </div>
                           <div>
                             <p className="font-medium">Loyer {payment.periode}</p>
                             <p className="text-xs text-muted-foreground">Reçu le {formatDateShort(payment.date_paiement)}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold">{formatCurrency(payment.montant)}</p>
                           <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Payé</Badge>
                        </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-8">
                   <p className="text-muted-foreground mb-4">Aucun paiement enregistré récemment.</p>
                   <Button variant="outline" asChild>
                     <Link href={`/app/owner/money?lease_id=${leaseId}`}>Gérer la comptabilité</Link>
                   </Button>
                 </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
           <Card>
             <CardHeader>
               <CardTitle>Documents du bail</CardTitle>
             </CardHeader>
             <CardContent>
                {documents && documents.length > 0 ? (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents.map((doc: any) => (
                        <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                           <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                              <FileText className="h-10 w-10 text-blue-500" />
                              <div>
                                <p className="font-medium truncate w-full">{doc.title || doc.type}</p>
                                <p className="text-xs text-muted-foreground">{formatDateShort(doc.created_at)}</p>
                              </div>
                           </CardContent>
                        </Card>
                      ))}
                   </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Aucun document associé.</p>
                )}
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="details">
           <Card>
             <CardHeader>
               <CardTitle>Paramètres du bail</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type de bail</p>
                    <p>{lease.type_bail}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date de création</p>
                    <p>{formatDateShort(lease.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Renouvellement</p>
                    <p>Tacite reconduction</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Indexation</p>
                    <p>{lease.indice_reference || "Non définie"}</p>
                  </div>
               </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

