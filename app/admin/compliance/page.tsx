"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  RefreshCw,
  Download,
  User,
  Calendar,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_LABELS,
  type ComplianceDocumentType,
} from "@/lib/types/provider-compliance";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface PendingDocument {
  id: string;
  document_type: ComplianceDocumentType;
  storage_path: string;
  original_filename: string | null;
  file_size: number | null;
  mime_type: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  created_at: string;
  provider: {
    id: string;
    name: string;
    telephone: string | null;
  };
}

interface ExpiringDocument {
  provider_profile_id: string;
  provider_name: string;
  document_type: ComplianceDocumentType;
  document_id: string;
  expiration_date: string;
  days_until_expiry: number;
}

export default function AdminCompliancePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    documentId: string | null;
  }>({ open: false, action: null, documentId: null });
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Récupérer les documents en attente
      const pendingResponse = await fetch("/api/admin/compliance/documents/pending");
      if (pendingResponse.ok) {
        const data = await pendingResponse.json();
        setPendingDocs(data.documents || []);
      }

      // TODO: Récupérer les documents qui expirent bientôt
      // const expiringResponse = await fetch("/api/admin/compliance/documents/expiring");
      // if (expiringResponse.ok) {
      //   const data = await expiringResponse.json();
      //   setExpiringDocs(data.documents || []);
      // }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewDocument = async (doc: PendingDocument) => {
    setSelectedDoc(doc);
    try {
      const response = await fetch(`/api/provider/compliance/documents/${doc.id}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewUrl(data.document.signed_url);
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le document",
        variant: "destructive",
      });
    }
  };

  const handleAction = async () => {
    if (!actionDialog.documentId || !actionDialog.action) return;

    if (actionDialog.action === "reject" && !rejectionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez indiquer un motif de rejet",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(
        `/api/admin/compliance/documents/${actionDialog.documentId}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: actionDialog.action,
            rejection_reason: actionDialog.action === "reject" ? rejectionReason : null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la validation");
      }

      toast({
        title: actionDialog.action === "approve" ? "Document validé" : "Document rejeté",
        description: "Le prestataire a été notifié.",
      });

      setActionDialog({ open: false, action: null, documentId: null });
      setRejectionReason("");
      setSelectedDoc(null);
      setPreviewUrl(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

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
          <Shield className="h-6 w-6 text-primary" />
          Validation des documents prestataires
        </h1>
        <p className="text-muted-foreground">
          Vérifiez et validez les documents de conformité des prestataires
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-3xl font-bold text-amber-600">{pendingDocs.length}</p>
              </div>
              <Clock className="h-10 w-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expirent bientôt</p>
                <p className="text-3xl font-bold text-orange-600">{expiringDocs.length}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Actions aujourd'hui</p>
                <p className="text-3xl font-bold text-green-600">0</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              En attente ({pendingDocs.length})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Expirent bientôt ({expiringDocs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents en attente de validation</CardTitle>
                <CardDescription>
                  Vérifiez chaque document et approuvez ou rejetez
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-200 mb-4" />
                    <h3 className="text-lg font-semibold">Tout est à jour !</h3>
                    <p className="text-muted-foreground">
                      Aucun document en attente de validation
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestataire</TableHead>
                        <TableHead>Type de document</TableHead>
                        <TableHead>Fichier</TableHead>
                        <TableHead>Date d'expiration</TableHead>
                        <TableHead>Soumis</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDocs.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{doc.provider.name}</p>
                                {doc.provider.telephone && (
                                  <p className="text-xs text-muted-foreground">
                                    {doc.provider.telephone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {DOCUMENT_TYPE_LABELS[doc.document_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm truncate max-w-[150px]">
                                {doc.original_filename || "Document"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.expiration_date ? (
                              <span className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {new Date(doc.expiration_date).toLocaleDateString("fr-FR")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(doc.created_at), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDocument(doc)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    action: "approve",
                                    documentId: doc.id,
                                  })
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    action: "reject",
                                    documentId: doc.id,
                                  })
                                }
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiring" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents qui expirent bientôt</CardTitle>
                <CardDescription>
                  Documents vérifiés qui arrivent à expiration dans les 30 prochains jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expiringDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-200 mb-4" />
                    <h3 className="text-lg font-semibold">Aucune expiration proche</h3>
                    <p className="text-muted-foreground">
                      Tous les documents sont valides pour les 30 prochains jours
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestataire</TableHead>
                        <TableHead>Type de document</TableHead>
                        <TableHead>Date d'expiration</TableHead>
                        <TableHead>Jours restants</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringDocs.map((doc) => (
                        <TableRow key={doc.document_id}>
                          <TableCell>
                            <p className="font-medium">{doc.provider_name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {DOCUMENT_TYPE_LABELS[doc.document_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(doc.expiration_date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                doc.days_until_expiry <= 7
                                  ? "bg-red-100 text-red-700"
                                  : doc.days_until_expiry <= 14
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-yellow-100 text-yellow-700"
                              )}
                            >
                              {doc.days_until_expiry} jour(s)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              Notifier
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialog de prévisualisation */}
      <Dialog
        open={!!selectedDoc}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDoc(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc && DOCUMENT_TYPE_LABELS[selectedDoc.document_type]}
            </DialogTitle>
            <DialogDescription>
              {selectedDoc?.provider.name} • {selectedDoc?.original_filename}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {previewUrl ? (
              selectedDoc?.mime_type?.includes("pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[500px] rounded-lg border"
                  title="Document preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Document"
                  className="max-w-full max-h-[500px] mx-auto rounded-lg"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-40 sm:h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDoc(null);
                setPreviewUrl(null);
              }}
            >
              Fermer
            </Button>
            {previewUrl && (
              <Button variant="outline" asChild>
                <a href={previewUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </a>
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedDoc) {
                  setActionDialog({
                    open: true,
                    action: "reject",
                    documentId: selectedDoc.id,
                  });
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeter
            </Button>
            <Button
              onClick={() => {
                if (selectedDoc) {
                  setActionDialog({
                    open: true,
                    action: "approve",
                    documentId: selectedDoc.id,
                  });
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'action */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog({ open: false, action: null, documentId: null });
            setRejectionReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "approve"
                ? "Confirmer l'approbation"
                : "Confirmer le rejet"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === "approve"
                ? "Le document sera marqué comme vérifié et le prestataire sera notifié."
                : "Veuillez indiquer le motif du rejet. Le prestataire pourra soumettre un nouveau document."}
            </DialogDescription>
          </DialogHeader>

          {actionDialog.action === "reject" && (
            <div className="py-4">
              <Label htmlFor="rejection-reason">Motif du rejet *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Document illisible, date d'expiration dépassée, document incomplet..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, action: null, documentId: null })}
              disabled={processing}
            >
              Annuler
            </Button>
            <Button
              variant={actionDialog.action === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing || (actionDialog.action === "reject" && !rejectionReason.trim())}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : actionDialog.action === "approve" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {actionDialog.action === "approve" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

