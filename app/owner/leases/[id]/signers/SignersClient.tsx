"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  UserPlus,
  Phone,
  Mail,
  RefreshCw,
  Trash2,
  Loader2,
  ShieldPlus,
} from "lucide-react";
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
import { TenantInviteModal } from "./TenantInviteModal";

interface Signer {
  id: string;
  role: string;
  signature_status: string;
  signed_at: string | null;
  invited_email?: string;
  invited_name?: string;
  invited_at?: string;
  profile: {
    id: string;
    prenom: string;
    nom: string;
    email?: string;
    telephone?: string;
    avatar_url?: string;
  } | null;
}

interface SignersClientProps {
  signers: Signer[];
  lease: {
    id: string;
    statut: string;
    type_bail: string;
    loyer: number;
    charges_forfaitaires: number;
  };
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
  };
  leaseId: string;
  ownerProfile: {
    id: string;
    prenom: string;
    nom: string;
  };
}

// Labels pour les rôles
const ROLE_LABELS: Record<string, string> = {
  proprietaire: "Propriétaire (Bailleur)",
  locataire_principal: "Locataire principal",
  colocataire: "Colocataire",
  garant: "Garant",
};

// Config des statuts de signature
const SIGNATURE_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "En attente",
    icon: <Clock className="h-4 w-4" />,
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  signed: {
    label: "Signé",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-green-100 text-green-700 border-green-300",
  },
  refused: {
    label: "Refusé",
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-red-100 text-red-700 border-red-300",
  },
};

export function SignersClient({
  signers,
  lease,
  property,
  leaseId,
  ownerProfile,
}: SignersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<"locataire_principal" | "colocataire" | "garant">("locataire_principal");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Séparer les signataires par rôle
  const owner = signers.find((s) => s.role === "proprietaire");
  const mainTenant = signers.find((s) => s.role === "locataire_principal");
  const cotenants = signers.filter((s) => s.role === "colocataire");
  const guarantors = signers.filter((s) => s.role === "garant");

  // Calculer les statistiques
  const totalSigners = signers.length;
  const signedCount = signers.filter((s) => s.signature_status === "signed").length;
  const pendingCount = signers.filter((s) => s.signature_status === "pending").length;

  // Le bail peut-il être modifié ?
  const canEdit = 
    lease.statut === "draft" || 
    lease.statut === "sent" || 
    lease.statut === "pending_signature" || 
    lease.statut === "partially_signed" ||
    lease.statut === "pending_owner_signature";
  const isColocation = lease.type_bail === "colocation";

  const getInitials = (prenom?: string, nom?: string) => {
    return `${prenom?.charAt(0) || ""}${nom?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Ouvrir le modal d'invitation avec un rôle spécifique
  const openInviteModal = (role: "locataire_principal" | "colocataire" | "garant") => {
    setInviteRole(role);
    setShowInviteModal(true);
  };

  // Relancer une invitation
  const handleResendInvite = async (signerId: string, email?: string) => {
    if (!email) {
      toast({
        title: "Erreur",
        description: "Email du signataire non disponible",
        variant: "destructive",
      });
      return;
    }

    setResendingId(signerId);
    try {
      const response = await fetch(`/api/leases/${leaseId}/signers/${signerId}/resend`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi");
      }

      toast({
        title: "Invitation relancée",
        description: `Un nouvel email a été envoyé à ${email}`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  // Supprimer un signataire
  const handleDeleteSigner = async (signerId: string) => {
    setDeletingId(signerId);
    try {
      const response = await fetch(`/api/leases/${leaseId}/signers/${signerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      toast({
        title: "Signataire supprimé",
        description: "Le signataire a été retiré du bail",
      });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Callback après invitation réussie
  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    router.refresh();
  };

  // Composant carte signataire avec actions
  const SignerCard = ({ 
    signer, 
    roleLabel,
    showActions = true,
  }: { 
    signer: Signer; 
    roleLabel: string;
    showActions?: boolean;
  }) => {
    const statusConfig =
      SIGNATURE_STATUS_CONFIG[signer.signature_status] || SIGNATURE_STATUS_CONFIG.pending;
    
    const email = signer.profile?.email || signer.invited_email;
    const canResend = signer.signature_status === "pending" && email;
    const canDelete = canEdit && signer.role !== "proprietaire";
    const isResending = resendingId === signer.id;
    const isDeleting = deletingId === signer.id;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={signer.profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-slate-100 text-slate-700">
                {getInitials(signer.profile?.prenom, signer.profile?.nom)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">
                  {signer.profile
                    ? `${signer.profile.prenom} ${signer.profile.nom}`
                    : signer.invited_name || "En attente d'inscription"}
                </h3>
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mt-1">{roleLabel}</p>

              {/* Email */}
              {email && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <Mail className="h-3 w-3" />
                  {email}
                </div>
              )}

              {/* Téléphone */}
              {signer.profile?.telephone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Phone className="h-3 w-3" />
                  {signer.profile.telephone}
                </div>
              )}

              {/* Date de signature */}
              {signer.signed_at && (
                <p className="text-xs text-green-600 mt-2">
                  Signé le {formatDate(signer.signed_at)}
                </p>
              )}
            </div>

            {/* Actions */}
            {showActions && (canResend || canDelete) && (
              <div className="flex flex-col gap-2 shrink-0">
                {canResend && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendInvite(signer.id, email)}
                    disabled={isResending}
                    className="flex items-center gap-2"
                  >
                    {isResending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Relancer</span>
                  </Button>
                )}
                
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Supprimer</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce signataire ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {signer.profile 
                            ? `${signer.profile.prenom} ${signer.profile.nom} sera retiré du bail.`
                            : "Ce signataire sera retiré du bail."}
                          <span className="block mt-2 font-medium text-slate-900">
                            Vous pourrez ensuite inviter le bon locataire.
                          </span>
                          {signer.signature_status === "signed" && (
                            <span className="block mt-2 text-amber-600 font-bold">
                              Attention : cette personne a déjà signé le bail !
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteSigner(signer.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Composant pour afficher une section vide avec bouton d'invitation
  const EmptySection = ({ 
    title, 
    role 
  }: { 
    title: string; 
    role: "locataire_principal" | "colocataire" | "garant";
  }) => (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
      <CardContent className="p-6 text-center">
        <UserPlus className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-700 mb-2">Aucun {title.toLowerCase()}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Invitez une personne pour qu'elle puisse signer le bail.
        </p>
        <Button onClick={() => openInviteModal(role)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un {title.toLowerCase()}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour au bail
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                Signataires du bail
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Building2 className="h-4 w-4" />
                <span>
                  {property.adresse_complete}, {property.code_postal} {property.ville}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-white rounded-lg border">
                <p className="text-2xl font-bold text-slate-900">{signedCount}/{totalSigners}</p>
                <p className="text-xs text-muted-foreground">Signatures</p>
              </div>
              {pendingCount > 0 && (
                <div className="text-center px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
                  <p className="text-xs text-amber-600">En attente</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Liste des signataires */}
        <div className="space-y-6">
          {/* Propriétaire */}
          {owner && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Bailleur
              </h2>
              <SignerCard signer={owner} roleLabel={ROLE_LABELS[owner.role]} showActions={false} />
            </section>
          )}

          {/* Locataire principal - TOUJOURS AFFICHÉ */}
            <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Locataire principal
              </h2>
              {mainTenant && canEdit && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => openInviteModal("garant")}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ShieldPlus className="h-4 w-4 mr-1" />
                  Ajouter garant
                </Button>
              )}
            </div>
            {mainTenant ? (
              <SignerCard signer={mainTenant} roleLabel={ROLE_LABELS[mainTenant.role]} />
            ) : (
              <EmptySection title="Locataire" role="locataire_principal" />
            )}
            </section>

          {/* Colocataires (si colocation) */}
          {isColocation && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Colocataires ({cotenants.length})
              </h2>
                {canEdit && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openInviteModal("colocataire")}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                )}
              </div>
              {cotenants.length > 0 ? (
              <div className="grid gap-3">
                {cotenants.map((cotenant) => (
                  <SignerCard
                    key={cotenant.id}
                    signer={cotenant}
                    roleLabel={ROLE_LABELS[cotenant.role]}
                  />
                ))}
              </div>
              ) : (
                <Card className="border-dashed border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4 text-center text-sm text-muted-foreground">
                    Aucun colocataire pour le moment
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* Garants */}
          {guarantors.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Garants ({guarantors.length})
              </h2>
              <div className="grid gap-3">
                {guarantors.map((guarantor) => (
                  <SignerCard
                    key={guarantor.id}
                    signer={guarantor}
                    roleLabel={ROLE_LABELS[guarantor.role]}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href={`/owner/leases/${leaseId}`}>
              Voir le bail complet
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/owner/leases/${leaseId}/edit`}>
              Modifier le bail
            </Link>
          </Button>
        </div>
      </div>

      {/* Modal d'invitation */}
      <TenantInviteModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        leaseId={leaseId}
        property={property}
        role={inviteRole}
        ownerName={`${ownerProfile.prenom} ${ownerProfile.nom}`}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
