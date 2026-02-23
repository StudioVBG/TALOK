"use client";

import { useEffect, useState, useCallback } from "react";
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
  Plus,
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

interface TenantProfileCNI {
  cni_recto_path: string | null;
  cni_verso_path: string | null;
  cni_verified_at: string | null;
  cni_verification_method: string | null;
  cni_number: string | null;
  cni_expiry_date: string | null;
  identity_data: Record<string, string> | null;
  kyc_status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
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
    color: "bg-muted text-muted-foreground border-border",
    icon: AlertTriangle,
  },
  processing: {
    label: "En cours de traitement",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: Loader2,
  },
};

export default function TenantIdentityPage() {
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseWithCNI[]>([]);
  const [tenantProfile, setTenantProfile] = useState<TenantProfileCNI | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCNIDocuments = useCallback(async () => {
    try {
      setLoading(true);

      // Source 1: Récupérer les données CNI depuis tenant_profiles
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Non authentifié");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        setError("Profil non trouvé");
        return;
      }

      setProfileId(profile.id);

      const { data: tpData } = await supabase
        .from("tenant_profiles")
        .select("cni_recto_path, cni_verso_path, cni_verified_at, cni_verification_method, cni_number, cni_expiry_date, identity_data, kyc_status")
        .eq("profile_id", profile.id)
        .single();

      if (tpData) {
        setTenantProfile(tpData as TenantProfileCNI);
      }

      // Source 2: Récupérer les baux via l'API server-side (bypass RLS + auto-link)
      const res = await fetch("/api/tenant/identity/my-leases");
      if (res.ok) {
        const data = await res.json();
        const leasesWithCNI: LeaseWithCNI[] = (data.leases || []).map(
          (lease: Record<string, unknown>) => ({
            id: lease.id as string,
            type_bail: lease.type_bail as string,
            property: lease.property as { adresse_complete: string; ville: string },
            documents: (lease.documents || []) as CNIDocument[],
          })
        );
        setLeases(leasesWithCNI);
      }
    } catch (err: unknown) {
      console.error("Erreur chargement CNI:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCNIDocuments();
  }, [fetchCNIDocuments]);

  const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryAlert = (daysLeft: number | null): { type: string; message: string } | null => {
    if (daysLeft === null) return null;
    if (daysLeft <= 0) return { type: "error", message: "Votre CNI a expiré. Veuillez la renouveler." };
    if (daysLeft <= 7) return { type: "error", message: `Votre CNI expire dans ${daysLeft} jour(s). Renouvelez-la maintenant !` };
    if (daysLeft <= 15) return { type: "warning", message: `Votre CNI expire dans ${daysLeft} jours. Pensez à la renouveler.` };
    if (daysLeft <= 30) return { type: "warning", message: `Votre CNI expire dans ${daysLeft} jours.` };
    return null;
  };

  const handleViewDocument = async (storagePath: string) => {
    try {
      setViewingDoc(storagePath);
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 300);

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Erreur affichage document:", err);
    } finally {
      setViewingDoc(null);
    }
  };

  // Déterminer si le locataire a une CNI (de quelque source que ce soit)
  const hasProfileCNI = tenantProfile?.cni_recto_path || tenantProfile?.cni_verified_at;
  const hasLeaseCNI = leases.some(l => l.documents.some(d => d.type === "cni_recto" && !d.is_archived));
  const hasAnyCNI = hasProfileCNI || hasLeaseCNI;

  // Déterminer le statut global de vérification
  const getGlobalKycStatus = (): string => {
    if (tenantProfile?.kyc_status === "verified") return "verified";
    if (tenantProfile?.cni_verified_at) return "verified";
    if (hasLeaseCNI) {
      const firstRecto = leases
        .flatMap(l => l.documents)
        .find(d => d.type === "cni_recto" && !d.is_archived);
      return firstRecto?.verification_status || "pending";
    }
    return "pending";
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
            <p className="text-muted-foreground">Gérez vos documents d&apos;identité</p>
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

      {/* Section : Données CNI depuis tenant_profiles (onboarding) */}
      {hasProfileCNI && !hasLeaseCNI && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Document d&apos;identité (profil)
                  </CardTitle>
                  <CardDescription>
                    CNI enregistrée via la vérification d&apos;identité
                  </CardDescription>
                </div>
                {(() => {
                  const status = getGlobalKycStatus();
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                  const StatusIcon = config.icon;
                  return (
                    <Badge className={config.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantProfile?.cni_expiry_date && (() => {
                const daysLeft = getDaysUntilExpiry(tenantProfile.cni_expiry_date);
                const alert = getExpiryAlert(daysLeft);
                if (!alert) return null;
                return (
                  <Alert variant={alert.type === "error" ? "destructive" : "default"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{alert.message}</AlertDescription>
                  </Alert>
                );
              })()}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Recto */}
                <div className={`p-4 rounded-lg border ${tenantProfile?.cni_recto_path ? "bg-muted" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Recto CNI</span>
                  </div>
                  {tenantProfile?.cni_recto_path ? (
                    <div className="space-y-1 text-sm">
                      {tenantProfile.identity_data?.nom && (
                        <p><span className="text-muted-foreground">Nom:</span> {tenantProfile.identity_data.nom}</p>
                      )}
                      {tenantProfile.identity_data?.prenom && (
                        <p><span className="text-muted-foreground">Prénom:</span> {tenantProfile.identity_data.prenom}</p>
                      )}
                      {tenantProfile.cni_expiry_date && (
                        <p className={(() => {
                          const d = getDaysUntilExpiry(tenantProfile.cni_expiry_date);
                          return d !== null && d <= 30 ? "text-amber-600 font-medium" : "";
                        })()}>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Expire le {formatDate(tenantProfile.cni_expiry_date)}
                        </p>
                      )}
                      {tenantProfile.cni_verified_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Vérifié le {formatDate(tenantProfile.cni_verified_at)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600">Non fourni</p>
                  )}
                </div>

                {/* Verso */}
                <div className={`p-4 rounded-lg border ${tenantProfile?.cni_verso_path ? "bg-muted" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Verso CNI</span>
                  </div>
                  {tenantProfile?.cni_verso_path ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-green-600">
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                        Document fourni
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600">Non fourni</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {tenantProfile?.cni_recto_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleViewDocument(tenantProfile.cni_recto_path!)}
                    disabled={viewingDoc === tenantProfile.cni_recto_path}
                  >
                    {viewingDoc === tenantProfile.cni_recto_path ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Voir le recto
                  </Button>
                )}
                {tenantProfile?.cni_verso_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleViewDocument(tenantProfile.cni_verso_path!)}
                    disabled={viewingDoc === tenantProfile.cni_verso_path}
                  >
                    {viewingDoc === tenantProfile.cni_verso_path ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Voir le verso
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Section : Documents CNI par bail */}
      {leases.length > 0 && (
        <div className="space-y-6">
          {leases.map((lease) => {
            const rectoDoc = lease.documents.find(d => d.type === "cni_recto" && !d.is_archived);
            const versoDoc = lease.documents.find(d => d.type === "cni_verso" && !d.is_archived);
            const expiryDate = rectoDoc?.expiry_date || rectoDoc?.metadata?.date_expiration || null;
            const daysLeft = getDaysUntilExpiry(expiryDate);
            const expiryAlert = getExpiryAlert(daysLeft);
            const status = rectoDoc?.verification_status || "pending";
            const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
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
                          {lease.property.ville} &bull; {lease.type_bail === "meuble" ? "Location meublée" : "Location nue"}
                        </CardDescription>
                      </div>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {expiryAlert && (
                      <Alert variant={expiryAlert.type === "error" ? "destructive" : "default"}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{expiryAlert.message}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Recto */}
                      <div className={`p-4 rounded-lg border ${rectoDoc ? "bg-muted" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                              <p className={daysLeft !== null && daysLeft <= 30 ? "text-amber-600 font-medium" : ""}>
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
                      <div className={`p-4 rounded-lg border ${versoDoc ? "bg-muted" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                      {/* Upload initial si pas de documents */}
                      {!rectoDoc && !versoDoc && (
                        <Link
                          href={`/tenant/identity/renew?lease_id=${lease.id}`}
                          className={cn(buttonVariants({ variant: "default" }), "gap-2")}
                        >
                          <Upload className="h-4 w-4" />
                          Ajouter ma CNI
                        </Link>
                      )}

                      {/* Renouvellement si expiré ou expire bientôt */}
                      {rectoDoc && (status === "expired" || (daysLeft !== null && daysLeft <= 30)) && (
                        <Link
                          href={`/tenant/identity/renew?lease_id=${lease.id}`}
                          className={cn(buttonVariants({ variant: "default" }), "gap-2")}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Renouveler ma CNI
                        </Link>
                      )}

                      {/* Voir le document recto */}
                      {rectoDoc && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleViewDocument(rectoDoc.storage_path)}
                          disabled={viewingDoc === rectoDoc.storage_path}
                        >
                          {viewingDoc === rectoDoc.storage_path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Voir le recto
                        </Button>
                      )}

                      {/* Voir le document verso */}
                      {versoDoc && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleViewDocument(versoDoc.storage_path)}
                          disabled={viewingDoc === versoDoc.storage_path}
                        >
                          {viewingDoc === versoDoc.storage_path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Voir le verso
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

      {/* Section : Aucun document - avec bouton d'action */}
      {!hasAnyCNI && (
        <Card className="text-center py-12">
          <CardContent>
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun document d&apos;identité</h3>
            <p className="text-muted-foreground mb-6">
              Vous n&apos;avez pas encore vérifié votre identité. Ajoutez votre CNI pour compléter votre dossier.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/tenant/onboarding/identity"
                className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              >
                <Plus className="h-4 w-4" />
                Vérifier mon identité
              </Link>
              {leases.length > 0 && (
                <Link
                  href={`/tenant/identity/renew?lease_id=${leases[0].id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  <Upload className="h-4 w-4" />
                  Importer ma CNI
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
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
