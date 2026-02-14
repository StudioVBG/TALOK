"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Shield,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Calendar,
  Upload,
  Loader2,
  Eye,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/helpers/format";
import { motion } from "framer-motion";

interface CNIDocument {
  id: string;
  type: "cni_recto" | "cni_verso";
  storage_path: string;
  expiry_date: string | null;
  verification_status: "pending" | "verified" | "rejected" | "expired";
  is_archived: boolean;
  created_at: string;
  metadata: {
    nom?: string;
    prenom?: string;
    date_expiration?: string;
    ocr_confidence?: number;
  };
}

interface LeaseWithCNI {
  id: string;
  type_bail: string;
  property: {
    adresse_complete: string;
    ville: string;
  };
  documents: CNIDocument[];
}

const STATUS_CONFIG = {
  pending: { 
    label: "En attente de vérification", 
    color: "bg-amber-100 text-amber-700 border-amber-300",
    icon: Clock,
  },
  verified: { 
    label: "Vérifié", 
    color: "bg-green-100 text-green-700 border-green-300",
    icon: CheckCircle,
  },
  rejected: { 
    label: "Rejeté", 
    color: "bg-red-100 text-red-700 border-red-300",
    icon: XCircle,
  },
  expired: { 
    label: "Expiré", 
    color: "bg-slate-100 text-slate-700 border-slate-300",
    icon: AlertTriangle,
  },
};

export default function TenantIdentityPage() {
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseWithCNI[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchCNIDocuments();
  }, []);

  const fetchCNIDocuments = async () => {
    try {
      setLoading(true);
      
      // Récupérer l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Non authentifié");
        return;
      }

      // Récupérer le profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        setError("Profil non trouvé");
        return;
      }

      // Récupérer les baux où le locataire est signataire
      const { data: signerData } = await supabase
        .from("lease_signers")
        .select(`
          lease_id,
          leases (
            id,
            type_bail,
            property:properties (
              adresse_complete,
              ville
            )
          )
        `)
        .eq("profile_id", profile.id)
        .in("role", ["locataire_principal", "colocataire"]);

      if (!signerData || signerData.length === 0) {
        setLeases([]);
        return;
      }

      // Récupérer les documents CNI pour chaque bail
      const leasesWithCNI: LeaseWithCNI[] = [];

      for (const signer of signerData) {
        if (!signer.leases) continue;
        
        const lease = signer.leases as any;
        
        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .eq("lease_id", lease.id)
          .in("type", ["cni_recto", "cni_verso"])
          .order("created_at", { ascending: false });

        leasesWithCNI.push({
          id: lease.id,
          type_bail: lease.type_bail,
          property: lease.property,
          documents: (documents || []) as CNIDocument[],
        });
      }

      setLeases(leasesWithCNI);
    } catch (err: any) {
      console.error("Erreur chargement CNI:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculer le nombre de jours avant expiration
  const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Obtenir l'alerte d'expiration
  const getExpiryAlert = (daysLeft: number | null) => {
    if (daysLeft === null) return null;
    if (daysLeft <= 0) return { type: "error", message: "Votre CNI a expiré. Veuillez la renouveler." };
    if (daysLeft <= 7) return { type: "error", message: `Votre CNI expire dans ${daysLeft} jour(s). Renouvelez-la maintenant !` };
    if (daysLeft <= 15) return { type: "warning", message: `Votre CNI expire dans ${daysLeft} jours. Pensez à la renouveler.` };
    if (daysLeft <= 30) return { type: "warning", message: `Votre CNI expire dans ${daysLeft} jours.` };
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/tenant/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2 text-muted-foreground")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour au tableau de bord
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mon identité</h1>
            <p className="text-muted-foreground">Gérez vos documents d'identité</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {leases.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CreditCard className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun document d'identité</h3>
            <p className="text-muted-foreground">
              Vous n'avez pas encore de documents d'identité associés à un bail.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {leases.map((lease) => {
            const rectoDoc = lease.documents.find(d => d.type === "cni_recto" && !d.is_archived);
            const versoDoc = lease.documents.find(d => d.type === "cni_verso" && !d.is_archived);
            const expiryDate = rectoDoc?.expiry_date || rectoDoc?.metadata?.date_expiration;
            const daysLeft = getDaysUntilExpiry(expiryDate ?? null);
            const expiryAlert = getExpiryAlert(daysLeft);
            const status = rectoDoc?.verification_status || "pending";
            const statusConfig = STATUS_CONFIG[status];
            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={lease.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {lease.property.adresse_complete}
                        </CardTitle>
                        <CardDescription>
                          {lease.property.ville} • {lease.type_bail === "meuble" ? "Location meublée" : "Location nue"}
                        </CardDescription>
                      </div>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Alerte d'expiration */}
                    {expiryAlert && (
                      <Alert variant={expiryAlert.type === "error" ? "destructive" : "default"}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{expiryAlert.message}</AlertDescription>
                      </Alert>
                    )}

                    {/* Documents */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Recto */}
                      <div className={`p-4 rounded-lg border ${rectoDoc ? "bg-slate-50" : "bg-amber-50 border-amber-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-slate-600" />
                          <span className="font-medium">Recto CNI</span>
                        </div>
                        {rectoDoc ? (
                          <div className="space-y-1 text-sm">
                            {rectoDoc.metadata?.nom && (
                              <p><span className="text-muted-foreground">Nom:</span> {rectoDoc.metadata.nom}</p>
                            )}
                            {rectoDoc.metadata?.prenom && (
                              <p><span className="text-muted-foreground">Prénom:</span> {rectoDoc.metadata.prenom}</p>
                            )}
                            {expiryDate && (
                              <p className={daysLeft && daysLeft <= 30 ? "text-amber-600 font-medium" : ""}>
                                <Calendar className="h-3 w-3 inline mr-1" />
                                Expire le {formatDate(expiryDate)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Uploadé le {formatDate(rectoDoc.created_at)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-600">Non fourni</p>
                        )}
                      </div>

                      {/* Verso */}
                      <div className={`p-4 rounded-lg border ${versoDoc ? "bg-slate-50" : "bg-amber-50 border-amber-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-slate-600" />
                          <span className="font-medium">Verso CNI</span>
                        </div>
                        {versoDoc ? (
                          <div className="space-y-1 text-sm">
                            <p className="text-green-600">
                              <CheckCircle className="h-3 w-3 inline mr-1" />
                              Document fourni
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Uploadé le {formatDate(versoDoc.created_at)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-600">Non fourni</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Bouton renouvellement si expiré ou expire bientôt */}
                      {(status === "expired" || (daysLeft !== null && daysLeft <= 30)) && (
                        <Link
                          href={`/tenant/identity/renew?lease_id=${lease.id}`}
                          className={cn(buttonVariants({ variant: "default" }), "gap-2")}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Renouveler ma CNI
                        </Link>
                      )}

                      {/* Voir le document */}
                      {rectoDoc && (
                        <Button variant="outline" size="sm" className="gap-2" disabled>
                          <Eye className="h-4 w-4" />
                          Voir le document
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Informations */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Pourquoi ma CNI est-elle requise ?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Vérification de votre identité pour la signature du bail</li>
            <li>Conformité avec la loi ALUR sur la location immobilière</li>
            <li>Protection contre la fraude documentaire</li>
            <li>Vos données sont sécurisées et ne sont pas partagées</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

