"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  UserPlus,
  Mail,
  Phone,
} from "lucide-react";

interface Signer {
  id: string;
  role: string;
  signature_status: string;
  signed_at: string | null;
  profile: {
    id: string;
    prenom: string;
    nom: string;
    telephone?: string;
    avatar_url?: string;
  } | null;
}

interface SignersClientProps {
  signers: Signer[];
  lease: any;
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

  // Séparer les signataires par rôle
  const owner = signers.find((s) => s.role === "proprietaire");
  const mainTenant = signers.find((s) => s.role === "locataire_principal");
  const cotenants = signers.filter((s) => s.role === "colocataire");
  const guarantors = signers.filter((s) => s.role === "garant");

  // Calculer les statistiques
  const totalSigners = signers.length;
  const signedCount = signers.filter((s) => s.signature_status === "signed").length;
  const pendingCount = signers.filter((s) => s.signature_status === "pending").length;

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

  const SignerCard = ({ signer, roleLabel }: { signer: Signer; roleLabel: string }) => {
    const statusConfig =
      SIGNATURE_STATUS_CONFIG[signer.signature_status] || SIGNATURE_STATUS_CONFIG.pending;

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
                    : "En attente d'invitation"}
                </h3>
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mt-1">{roleLabel}</p>

              {signer.profile?.telephone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <Phone className="h-3 w-3" />
                  {signer.profile.telephone}
                </div>
              )}

              {signer.signed_at && (
                <p className="text-xs text-green-600 mt-2">
                  Signé le {formatDate(signer.signed_at)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
              <SignerCard signer={owner} roleLabel={ROLE_LABELS[owner.role]} />
            </section>
          )}

          {/* Locataire principal */}
          {mainTenant && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Locataire principal
              </h2>
              <SignerCard signer={mainTenant} roleLabel={ROLE_LABELS[mainTenant.role]} />
            </section>
          )}

          {/* Colocataires */}
          {cotenants.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Colocataires ({cotenants.length})
              </h2>
              <div className="grid gap-3">
                {cotenants.map((cotenant) => (
                  <SignerCard
                    key={cotenant.id}
                    signer={cotenant}
                    roleLabel={ROLE_LABELS[cotenant.role]}
                  />
                ))}
              </div>
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

          {/* Message si aucun signataire */}
          {signers.length === 0 && (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-700 mb-2">Aucun signataire</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Invitez le locataire pour commencer le processus de signature.
                </p>
                <Button asChild>
                  <Link href={`/app/owner/contracts/${leaseId}/edit`}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inviter un locataire
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href={`/app/owner/contracts/${leaseId}`}>
              Voir le bail complet
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/app/owner/contracts/${leaseId}/edit`}>
              Modifier le bail
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

