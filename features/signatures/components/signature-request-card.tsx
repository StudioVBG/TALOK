"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Users,
  Calendar,
  MoreVertical,
  RefreshCw,
  Download,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import type { SignatureRequest, SignatureRequestSigner, SignatureRequestStatus, SignerStatus } from "@/lib/signatures/types";

interface SignatureRequestCardProps {
  request: SignatureRequest & {
    signers: SignatureRequestSigner[];
  };
  onSend?: () => void;
  onCancel?: () => void;
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<SignatureRequestStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<any>;
  color: string;
}> = {
  draft: { label: "Brouillon", variant: "outline", icon: FileText, color: "text-muted-foreground" },
  pending: { label: "En attente", variant: "secondary", icon: Clock, color: "text-yellow-600" },
  ongoing: { label: "En cours", variant: "default", icon: Send, color: "text-blue-600" },
  done: { label: "Terminé", variant: "default", icon: CheckCircle, color: "text-green-600" },
  expired: { label: "Expiré", variant: "destructive", icon: AlertCircle, color: "text-orange-600" },
  canceled: { label: "Annulé", variant: "destructive", icon: XCircle, color: "text-red-600" },
  rejected: { label: "Refusé", variant: "destructive", icon: XCircle, color: "text-red-600" },
};

const SIGNER_STATUS_CONFIG: Record<SignerStatus, {
  label: string;
  color: string;
}> = {
  pending: { label: "En attente", color: "bg-gray-200" },
  notified: { label: "Notifié", color: "bg-yellow-200" },
  opened: { label: "Ouvert", color: "bg-blue-200" },
  signed: { label: "Signé", color: "bg-green-200" },
  refused: { label: "Refusé", color: "bg-red-200" },
  error: { label: "Erreur", color: "bg-red-200" },
};

export function SignatureRequestCard({ request, onSend, onCancel, onRefresh }: SignatureRequestCardProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;

  // Calculer la progression
  const signedCount = request.signers.filter(s => s.status === "signed").length;
  const totalSigners = request.signers.length;
  const progress = totalSigners > 0 ? (signedCount / totalSigners) * 100 : 0;

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await fetch(`/api/signatures/requests/${request.id}/send`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi");
      }

      toast({
        title: "Demande envoyée",
        description: "Les signataires ont été notifiés par email.",
      });

      onRefresh?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const canSend = ["draft"].includes(request.status);
  const canCancel = ["draft", "pending", "ongoing"].includes(request.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {request.name}
              </CardTitle>
              <CardDescription>{request.description}</CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
                {statusConfig.label}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualiser
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Eye className="mr-2 h-4 w-4" />
                    Voir le document
                  </DropdownMenuItem>
                  {request.status === "done" && (
                    <DropdownMenuItem>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger signé
                    </DropdownMenuItem>
                  )}
                  {canCancel && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={onCancel}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Annuler
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progression */}
          {request.status === "ongoing" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{signedCount}/{totalSigners} signatures</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Signataires */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Signataires
            </div>
            <div className="flex flex-wrap gap-2">
              {request.signers.map((signer) => {
                const signerConfig = SIGNER_STATUS_CONFIG[signer.status];
                return (
                  <div
                    key={signer.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${signerConfig.color}`}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {signer.first_name[0]}{signer.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{signer.first_name} {signer.last_name}</span>
                    {signer.status === "signed" && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deadline */}
          {request.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Échéance:</span>
              <span>{new Date(request.deadline).toLocaleDateString("fr-FR")}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t pt-4">
          <div className="flex w-full gap-2">
            {canSend && (
              <Button
                onClick={handleSend}
                disabled={isSending}
                className="flex-1"
              >
                {isSending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Envoyer aux signataires
              </Button>
            )}
            
            {request.status === "done" && (
              <Button variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Télécharger le document signé
              </Button>
            )}

            {request.status === "pending_validation" && (
              <Button variant="outline" className="flex-1" disabled>
                <Clock className="mr-2 h-4 w-4" />
                En attente de validation
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

