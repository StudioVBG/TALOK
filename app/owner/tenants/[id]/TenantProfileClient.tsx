"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Euro,
  Shield,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Download,
  Home,
  ArrowLeft,
  CreditCard,
  X,
  ZoomIn,
  Building2,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

interface TenantDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  verified_at?: string;
  is_valid: boolean;
}

interface TenantProfile {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  avatar_url?: string;
  date_naissance?: string;
  created_at: string;
  tenant_profile?: {
    situation_pro?: string;
    revenus_mensuels?: number;
    nb_adultes?: number;
    nb_enfants?: number;
    employeur?: string;
    type_contrat?: string;
    cni_recto_path?: string;
    cni_verso_path?: string;
    cni_verified_at?: string;
    cni_verification_method?: string;
    identity_data?: Record<string, any>;
    adresse_precedente?: string;
    ville_precedente?: string;
  };
  roommates?: Array<{
    lease?: {
      id: string;
      type_bail: string;
      loyer: number;
      date_debut: string;
      date_fin?: string;
      statut: string;
      property?: {
        adresse_complete: string;
        code_postal: string;
        ville: string;
      };
    };
  }>;
  documents: TenantDocument[];
}

interface TenantProfileClientProps {
  tenant: TenantProfile;
  isAdmin?: boolean;
}

// Labels pour les types de documents
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cni_recto: "Carte d'identité (recto)",
  cni_verso: "Carte d'identité (verso)",
  passeport: "Passeport",
  titre_sejour: "Titre de séjour",
  justificatif_domicile: "Justificatif de domicile",
  justificatif_revenus: "Justificatif de revenus",
  avis_imposition: "Avis d'imposition",
  attestation_employeur: "Attestation employeur",
  contrat_travail: "Contrat de travail",
  bulletin_salaire: "Bulletin de salaire",
  autre: "Autre document",
};

// Labels pour les situations professionnelles
const SITUATION_PRO_LABELS: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  fonctionnaire: "Fonctionnaire",
  independant: "Indépendant",
  etudiant: "Étudiant",
  retraite: "Retraité",
  autre: "Autre",
};

export function TenantProfileClient({ tenant, isAdmin = false }: TenantProfileClientProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const tp = tenant.tenant_profile;
  const identityData = tp?.identity_data || {};
  const currentLease = tenant.roommates?.[0]?.lease;
  
  // URL pour les images CNI (via Supabase Storage)
  const getCniUrl = (path?: string) => {
    if (!path) return null;
    // En production, utiliser une URL signée
    return `/api/storage/tenant-documents/${path}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link href="/owner/leases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux baux
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar et nom */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                <AvatarImage src={tenant.avatar_url} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {tenant.prenom?.[0]}{tenant.nom?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  {tenant.prenom} {tenant.nom}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">Locataire</Badge>
                  {tp?.cni_verified_at && (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                      <BadgeCheck className="h-3 w-3" />
                      Identité vérifiée
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="md:ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Contacter
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Historique
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Infos principales */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations personnelles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informations personnelles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {tenant.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {tenant.telephone || "Non renseigné"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {tenant.date_naissance 
                        ? formatDateShort(tenant.date_naissance)
                        : identityData.date_naissance 
                        ? formatDateShort(identityData.date_naissance)
                        : "Non renseigné"
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Lieu de naissance</p>
                    <p className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {identityData.lieu_naissance || "Non renseigné"}
                    </p>
                  </div>
                  {tp?.adresse_precedente && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-sm text-muted-foreground">Adresse précédente</p>
                      <p className="font-medium flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        {tp.adresse_precedente}, {tp.ville_precedente}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Situation professionnelle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Situation professionnelle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Situation</p>
                    <p className="font-medium">
                      {tp?.situation_pro 
                        ? SITUATION_PRO_LABELS[tp.situation_pro] || tp.situation_pro
                        : "Non renseignée"
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Revenus mensuels</p>
                    <p className="font-medium flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      {tp?.revenus_mensuels 
                        ? formatCurrency(tp.revenus_mensuels)
                        : "Non renseignés"
                      }
                    </p>
                  </div>
                  {tp?.employeur && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Employeur</p>
                      <p className="font-medium">{tp.employeur}</p>
                    </div>
                  )}
                  {tp?.type_contrat && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Type de contrat</p>
                      <p className="font-medium">
                        {SITUATION_PRO_LABELS[tp.type_contrat] || tp.type_contrat}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bail en cours */}
            {currentLease && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Bail en cours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">
                          {currentLease.property?.adresse_complete}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentLease.property?.code_postal} {currentLease.property?.ville}
                        </p>
                      </div>
                      <Badge variant={
                        currentLease.statut === "active" ? "default" :
                        currentLease.statut === "pending_signature" ? "secondary" :
                        "outline"
                      }>
                        {currentLease.statut === "active" ? "Actif" :
                         currentLease.statut === "pending_signature" ? "En attente" :
                         currentLease.statut}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Loyer</p>
                        <p className="font-semibold text-primary">
                          {formatCurrency(currentLease.loyer)}/mois
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Début</p>
                        <p className="font-medium">
                          {formatDateShort(currentLease.date_debut)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fin</p>
                        <p className="font-medium">
                          {currentLease.date_fin 
                            ? formatDateShort(currentLease.date_fin)
                            : "Indéterminée"
                          }
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/owner/leases/${currentLease.id}`}>
                          Voir le bail
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne droite - Documents et vérification */}
          <div className="space-y-6">
            {/* Vérification d'identité */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vérification d'identité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tp?.cni_verified_at ? (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Identité vérifiée</span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                      {tp.cni_verification_method === "ocr_scan" && "Via scan de CNI"}
                      {tp.cni_verification_method === "france_identite" && "Via France Identité"}
                      {" • "}
                      {formatDateShort(tp.cni_verified_at)}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Non vérifiée</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      L'identité n'a pas encore été vérifiée
                    </p>
                  </div>
                )}

                {/* Photos CNI */}
                {(tp?.cni_recto_path || tp?.cni_verso_path) && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Pièce d'identité</p>
                    <div className="grid grid-cols-2 gap-3">
                      {tp?.cni_recto_path && (
                        <button
                          onClick={() => setImagePreview(getCniUrl(tp.cni_recto_path) || "")}
                          className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors group"
                        >
                          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <CreditCard className="h-8 w-8 text-slate-400" />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                            Recto
                          </span>
                        </button>
                      )}
                      {tp?.cni_verso_path && (
                        <button
                          onClick={() => setImagePreview(getCniUrl(tp.cni_verso_path) || "")}
                          className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors group"
                        >
                          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <CreditCard className="h-8 w-8 text-slate-400" />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                            Verso
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Données extraites */}
                {identityData.nom && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm space-y-1">
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Données extraites de la CNI
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Nom:</span>{" "}
                        <span className="font-medium">{identityData.nom}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Prénom:</span>{" "}
                        <span className="font-medium">{identityData.prenom}</span>
                      </div>
                      {identityData.date_naissance && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Né(e) le:</span>{" "}
                          <span className="font-medium">
                            {formatDateShort(identityData.date_naissance)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
                <CardDescription>
                  Pièces justificatives du locataire
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenant.documents.length > 0 ? (
                  <div className="space-y-2">
                    {tenant.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            doc.is_valid 
                              ? "bg-green-100 dark:bg-green-900/50 text-green-600"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateShort(doc.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.verified_at && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun document uploadé
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal aperçu image */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pièce d'identité</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[3/2] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            {imagePreview && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CreditCard className="h-16 w-16 text-slate-400" />
                <p className="absolute bottom-4 text-sm text-muted-foreground">
                  Aperçu du document
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImagePreview(null)}>
              Fermer
            </Button>
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

