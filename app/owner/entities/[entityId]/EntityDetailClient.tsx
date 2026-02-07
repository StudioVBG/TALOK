"use client";

/**
 * EntityDetailClient — Fiche détaillée d'une entité avec 5 onglets
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Building2,
  CreditCard,
  Users,
  FileText,
  Info,
  Star,
  Check,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { isDomTomPostalCode, getTvaRate } from "@/lib/entities/resolveOwnerIdentity";
import { useToast } from "@/components/ui/use-toast";
import { useEntityStore } from "@/stores/useEntityStore";
import { deleteEntity } from "../actions";

// ============================================
// TYPES
// ============================================

interface EntityDetailClientProps {
  entity: Record<string, unknown>;
  associates: Record<string, unknown>[];
}

type TabId = "info" | "bank" | "stripe" | "associates" | "documents";

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: "info", label: "Infos", icon: Info },
  { id: "bank", label: "Bancaire", icon: CreditCard },
  { id: "stripe", label: "Stripe", icon: CreditCard },
  { id: "associates", label: "Associés", icon: Users },
  { id: "documents", label: "Documents", icon: FileText },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  particulier: "Personnel",
  sci_ir: "SCI · IR",
  sci_is: "SCI · IS",
  sarl: "SARL",
  sarl_famille: "SARL de famille",
  eurl: "EURL",
  sas: "SAS",
  sasu: "SASU",
  sa: "SA",
  snc: "SNC",
  indivision: "Indivision",
  demembrement_usufruit: "Usufruit",
  demembrement_nue_propriete: "Nue-propriété",
  holding: "Holding",
};

// ============================================
// COMPONENT
// ============================================

export function EntityDetailClient({
  entity,
  associates,
}: EntityDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { removeEntity } = useEntityStore();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const entityType = (entity.entity_type as string) || "sci_ir";
  const typeLabel = ENTITY_TYPE_LABELS[entityType] || entityType;
  const siret = entity.siret as string | null;
  const postalCode = entity.code_postal_siege as string | null;
  const isDom = isDomTomPostalCode(postalCode);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteEntity({ id: entity.id as string });
      if (!result.success) {
        throw new Error(result.error);
      }
      removeEntity(entity.id as string);
      toast({
        title: "Entité supprimée",
        description: `${entity.nom as string} a été supprimée.`,
      });
      router.push("/owner/entities");
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Supprimer &laquo;{entity.nom as string}&raquo; ?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cette action est irr&eacute;versible. Les biens li&eacute;s &agrave; cette entit&eacute;
                devront &ecirc;tre r&eacute;assign&eacute;s.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Suppression..." : "Confirmer la suppression"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <Link
          href="/owner/entities"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Mes entités
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: entity.couleur
                  ? `${entity.couleur as string}20`
                  : "hsl(var(--muted))",
              }}
            >
              <Building2
                className="h-6 w-6"
                style={{
                  color: (entity.couleur as string) || undefined,
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {entity.nom as string}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{typeLabel}</Badge>
                {siret && (
                  <span className="text-xs text-muted-foreground font-mono">
                    SIRET{" "}
                    {siret.replace(
                      /(\d{3})(\d{3})(\d{3})(\d{5})/,
                      "$1 $2 $3 $4"
                    )}
                  </span>
                )}
                {isDom && (
                  <Badge variant="outline" className="text-xs">
                    DOM-TOM · TVA {getTvaRate(postalCode)}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/owner/entities/${entity.id}/edit`)}>
              Modifier
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "associates" && associates.length > 0 && (
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {associates.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "info" && <InfoTab entity={entity} />}
        {activeTab === "bank" && <BankTab entity={entity} />}
        {activeTab === "stripe" && <StripeTab />}
        {activeTab === "associates" && (
          <AssociatesTab associates={associates} />
        )}
        {activeTab === "documents" && <DocumentsTab />}
      </div>
    </div>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function InfoTab({ entity }: { entity: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Raison sociale" value={entity.nom as string} />
          <InfoRow
            label="Forme juridique"
            value={entity.forme_juridique as string}
          />
          <InfoRow
            label="Type d'entité"
            value={
              ENTITY_TYPE_LABELS[entity.entity_type as string] ||
              (entity.entity_type as string)
            }
          />
          <InfoRow
            label="Régime fiscal"
            value={
              (entity.regime_fiscal as string) === "ir"
                ? "Impôt sur le Revenu (IR)"
                : "Impôt sur les Sociétés (IS)"
            }
          />
          <InfoRow
            label="Capital social"
            value={
              entity.capital_social
                ? `${Number(entity.capital_social).toLocaleString("fr-FR")} €`
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Immatriculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="SIREN" value={entity.siren as string} />
          <InfoRow label="SIRET" value={entity.siret as string} />
          <InfoRow label="RCS" value={entity.rcs_ville as string} />
          <InfoRow label="N° TVA" value={entity.numero_tva as string} />
          <InfoRow
            label="Date de création"
            value={entity.date_creation as string}
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Siège social</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow
            label="Adresse"
            value={entity.adresse_siege as string}
          />
          <InfoRow
            label="Code postal"
            value={entity.code_postal_siege as string}
          />
          <InfoRow label="Ville" value={entity.ville_siege as string} />
        </CardContent>
      </Card>
    </div>
  );
}

function BankTab({ entity }: { entity: Record<string, unknown> }) {
  const hasIban = !!(entity.iban as string);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coordonnées bancaires</CardTitle>
      </CardHeader>
      <CardContent>
        {hasIban ? (
          <div className="space-y-3">
            <InfoRow
              label="IBAN"
              value={entity.iban as string}
              mono
            />
            <InfoRow label="BIC" value={entity.bic as string} mono />
            <InfoRow
              label="Banque"
              value={entity.banque_nom as string}
            />
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="font-medium">Aucun IBAN configuré</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez un IBAN pour recevoir les virements de loyers
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StripeTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stripe Connect</CardTitle>
      </CardHeader>
      <CardContent className="text-center py-8">
        <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Paiements en ligne</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Configurez Stripe Connect pour recevoir les paiements en ligne
          directement sur le compte de cette entité.
        </p>
        <Button variant="outline">Configurer Stripe</Button>
      </CardContent>
    </Card>
  );
}

function AssociatesTab({
  associates,
}: {
  associates: Record<string, unknown>[];
}) {
  if (associates.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun associé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez les associés ou gérants de cette entité
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Associés ({associates.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {associates.map((a) => (
            <div
              key={a.id as string}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {[a.prenom, a.nom].filter(Boolean).join(" ") ||
                    "Associé"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {a.is_gerant && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Gérant
                    </Badge>
                  )}
                  {a.pourcentage_capital && (
                    <span className="text-xs text-muted-foreground">
                      {Number(a.pourcentage_capital)}% du capital
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentsTab() {
  return (
    <Card>
      <CardContent className="text-center py-8">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Documents de l&apos;entité</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les baux, quittances et EDL associés à cette entité
          apparaîtront ici.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// HELPERS
// ============================================

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium text-right",
          mono && "font-mono",
          !value && "text-muted-foreground italic"
        )}
      >
        {value || "Non renseigné"}
      </span>
    </div>
  );
}
