"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Shield,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Building2,
  CreditCard,
  Landmark,
  FileCheck,
  Award,
  Eye,
  Trash2,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  KYC_STATUS_LABELS,
  KYC_STATUS_COLORS,
  PROVIDER_TYPE_LABELS,
  type ComplianceDocumentType,
  type ProviderType,
  type KYCStatus,
  type DocumentVerificationStatus,
} from "@/lib/types/provider-compliance";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Icônes par type de document
const DOCUMENT_ICONS: Record<ComplianceDocumentType, React.ReactNode> = {
  rc_pro: <Shield className="h-5 w-5" />,
  decennale: <Building2 className="h-5 w-5" />,
  kbis: <FileText className="h-5 w-5" />,
  id_card_recto: <CreditCard className="h-5 w-5" />,
  id_card_verso: <CreditCard className="h-5 w-5" />,
  rib: <Landmark className="h-5 w-5" />,
  urssaf: <FileCheck className="h-5 w-5" />,
  qualification: <Award className="h-5 w-5" />,
  insurance_other: <Shield className="h-5 w-5" />,
  other: <FileText className="h-5 w-5" />,
};

// Couleurs par statut
const STATUS_COLORS: Record<DocumentVerificationStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700", icon: <Clock className="h-4 w-4" /> },
  verified: { bg: "bg-green-100", text: "text-green-700", icon: <CheckCircle2 className="h-4 w-4" /> },
  rejected: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="h-4 w-4" /> },
  expired: { bg: "bg-gray-100", text: "text-gray-700", icon: <AlertTriangle className="h-4 w-4" /> },
};

interface ComplianceStatus {
  profile: { id: string; name: string };
  provider: {
    profile_id: string;
    provider_type: ProviderType;
    kyc_status: KYCStatus;
    compliance_score: number;
    status: string;
    raison_sociale?: string;
    siret?: string;
  };
  documents: Array<{
    id: string;
    document_type: ComplianceDocumentType;
    verification_status: DocumentVerificationStatus;
    expiration_date: string | null;
    original_filename: string | null;
    created_at: string;
    rejection_reason?: string;
  }>;
  requirements: Array<{
    document_type: ComplianceDocumentType;
    description: string;
    help_text: string;
    is_required: boolean;
    has_expiration: boolean;
  }>;
  missing_documents: Array<{
    document_type: ComplianceDocumentType;
    description: string;
    help_text: string;
    is_required: boolean;
  }>;
  compliance_score: number;
  payout_account: any;
  summary: {
    total_required: number;
    total_uploaded: number;
    total_verified: number;
    total_pending: number;
    total_rejected: number;
    total_expired: number;
    has_payout_account: boolean;
    can_receive_missions: boolean;
  };
}

export default function ProviderCompliancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ComplianceStatus | null>(null);
  const [uploadDialog, setUploadDialog] = useState<{
    open: boolean;
    documentType: ComplianceDocumentType | null;
    description: string;
    hasExpiration: boolean;
  }>({ open: false, documentType: null, description: "", hasExpiration: false });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/provider/compliance/status");
      if (!response.ok) throw new Error("Erreur lors du chargement");
      const data = await response.json();
      setStatus(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async () => {
    if (!selectedFile || !uploadDialog.documentType) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_type", uploadDialog.documentType);
      if (expirationDate) {
        formData.append("expiration_date", expirationDate);
      }

      const response = await fetch("/api/provider/compliance/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'upload");
      }

      toast({
        title: "Document uploadé",
        description: "Votre document est en attente de validation.",
      });

      setUploadDialog({ open: false, documentType: null, description: "", hasExpiration: false });
      setSelectedFile(null);
      setExpirationDate("");
      fetchStatus();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/provider/compliance/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      toast({
        title: "Document supprimé",
        description: "Vous pouvez uploader un nouveau document.",
      });

      fetchStatus();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const openUploadDialog = (req: {
    document_type: ComplianceDocumentType;
    description: string;
    has_expiration: boolean;
  }) => {
    setUploadDialog({
      open: true,
      documentType: req.document_type,
      description: req.description,
      hasExpiration: req.has_expiration,
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Erreur de chargement</h2>
            <p className="text-muted-foreground mb-4">
              Impossible de charger votre statut de compliance.
            </p>
            <Button onClick={() => fetchStatus()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kycColor = KYC_STATUS_COLORS[status.provider.kyc_status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700'
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-orange-500" />
          Mes documents légaux
        </h1>
        <p className="text-muted-foreground">
          Gérez vos documents de conformité pour recevoir des missions
        </p>
      </motion.div>

      {/* Statut global */}
      <motion.div variants={itemVariants}>
        <Card className={cn("border-2", status.summary.can_receive_missions ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50")}>
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-full", kycColor.bg)}>
                  {status.summary.can_receive_missions ? (
                    <CheckCircle2 className={cn("h-8 w-8", kycColor.text)} />
                  ) : (
                    <AlertTriangle className={cn("h-8 w-8", kycColor.text)} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {status.summary.can_receive_missions
                      ? "Vous êtes opérationnel !"
                      : "Dossier incomplet"}
                  </h2>
                  <p className="text-muted-foreground">
                    Statut KYC:{" "}
                    <Badge className={cn(kycColor.bg, kycColor.text)}>
                      {KYC_STATUS_LABELS[status.provider.kyc_status]}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Score de conformité</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {status.compliance_score}%
                  </p>
                </div>
                <Progress value={status.compliance_score} className="w-32" />
              </div>
            </div>

            {/* Résumé */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">{status.summary.total_required}</p>
                <p className="text-xs text-muted-foreground">Requis</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{status.summary.total_verified}</p>
                <p className="text-xs text-muted-foreground">Validés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{status.summary.total_pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{status.summary.total_rejected}</p>
                <p className="text-xs text-muted-foreground">Rejetés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">{status.missing_documents.length}</p>
                <p className="text-xs text-muted-foreground">Manquants</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Documents manquants */}
      {status.missing_documents.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                Documents à fournir
              </CardTitle>
              <CardDescription>
                Uploadez ces documents pour compléter votre dossier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {status.missing_documents.map((doc) => {
                  const requirement = status.requirements.find(
                    (r) => r.document_type === doc.document_type
                  );
                  return (
                    <div
                      key={doc.document_type}
                      className="flex items-center justify-between p-4 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                          {DOCUMENT_ICONS[doc.document_type]}
                        </div>
                        <div>
                          <p className="font-medium">{DOCUMENT_TYPE_LABELS[doc.document_type]}</p>
                          {doc.help_text && (
                            <p className="text-xs text-muted-foreground">{doc.help_text}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          openUploadDialog({
                            document_type: doc.document_type,
                            description: doc.description,
                            has_expiration: requirement?.has_expiration || false,
                          })
                        }
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Documents existants */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Mes documents</CardTitle>
            <CardDescription>
              Documents uploadés et leur statut de vérification
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status.documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Aucun document uploadé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {status.documents.map((doc) => {
                  const statusConfig = STATUS_COLORS[doc.verification_status];
                  const isExpired =
                    doc.expiration_date && new Date(doc.expiration_date) < new Date();
                  const expiresSoon =
                    doc.expiration_date &&
                    new Date(doc.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full", statusConfig.bg, statusConfig.text)}>
                          {DOCUMENT_ICONS[doc.document_type]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {DOCUMENT_TYPE_LABELS[doc.document_type]}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{doc.original_filename || "Document"}</span>
                            {doc.expiration_date && (
                              <>
                                <span>•</span>
                                <span className={cn(isExpired && "text-red-600", expiresSoon && !isExpired && "text-amber-600")}>
                                  {isExpired
                                    ? "Expiré"
                                    : `Expire le ${new Date(doc.expiration_date).toLocaleDateString("fr-FR")}`}
                                </span>
                              </>
                            )}
                          </div>
                          {doc.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1">
                              Motif: {doc.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={cn(statusConfig.bg, statusConfig.text, "gap-1")}>
                          {statusConfig.icon}
                          {VERIFICATION_STATUS_LABELS[doc.verification_status]}
                        </Badge>

                        {doc.verification_status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Type de prestataire */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Type de structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {PROVIDER_TYPE_LABELS[status.provider.provider_type]}
                </p>
                {status.provider.raison_sociale && (
                  <p className="text-sm text-muted-foreground">
                    {status.provider.raison_sociale}
                    {status.provider.siret && ` • SIRET: ${status.provider.siret}`}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => router.push("/provider/settings")}>
                Modifier
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialog d'upload */}
      <Dialog
        open={uploadDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setUploadDialog({ open: false, documentType: null, description: "", hasExpiration: false });
            setSelectedFile(null);
            setExpirationDate("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ajouter un document
            </DialogTitle>
            <DialogDescription>
              {uploadDialog.description || "Uploadez votre document (PDF, JPEG, PNG)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Formats acceptés: PDF, JPEG, PNG, WebP. Taille max: 10 MB
              </p>
            </div>

            {uploadDialog.hasExpiration && (
              <div className="space-y-2">
                <Label>Date d'expiration</Label>
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  disabled={uploading}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialog({ open: false, documentType: null, description: "", hasExpiration: false })}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Uploader
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

