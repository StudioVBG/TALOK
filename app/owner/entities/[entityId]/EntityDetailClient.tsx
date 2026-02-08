"use client";

/**
 * EntityDetailClient — Fiche détaillée d'une entité avec 6 onglets
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
  Home,
  Star,
  AlertCircle,
  Trash2,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { isDomTomPostalCode, getTvaRate } from "@/lib/entities/resolveOwnerIdentity";
import { useEntityStore } from "@/stores/useEntityStore";
import { deleteEntity } from "../actions";

// ============================================
// TYPES
// ============================================

interface EntityDetailClientProps {
  entity: Record<string, unknown>;
  associates: Record<string, unknown>[];
  properties: Record<string, unknown>[];
  unassignedProperties: Record<string, unknown>[];
}

type TabId = "info" | "properties" | "bank" | "stripe" | "associates" | "documents";

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: "info", label: "Infos", icon: Info },
  { id: "properties", label: "Biens", icon: Home },
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
  properties: initialProperties,
  unassignedProperties: initialUnassigned,
}: EntityDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { removeEntity } = useEntityStore();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [isDeleting, setIsDeleting] = useState(false);
  const [properties, setProperties] = useState(initialProperties);
  const [unassignedProperties, setUnassignedProperties] = useState(initialUnassigned);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteEntity({ id: entity.id as string });
      if (result.success) {
        removeEntity(entity.id as string);
        toast({
          title: "Entité supprimée",
          description: `${entity.nom as string} a été supprimée.`,
        });
        router.push("/owner/entities");
      } else {
        toast({
          title: "Suppression impossible",
          description: result.error || "Une erreur est survenue.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const entityType = (entity.entity_type as string) || "sci_ir";
  const typeLabel = ENTITY_TYPE_LABELS[entityType] || entityType;
  const siret = entity.siret as string | null;
  const postalCode = entity.code_postal_siege as string | null;
  const isDom = isDomTomPostalCode(postalCode);

  return (
    <div className="space-y-6">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/owner/entities/${entity.id}/edit`)}>
              Modifier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette entité ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous êtes sur le point de supprimer <strong>{entity.nom as string}</strong>.
                    Cette action est irréversible. Les associés liés seront également supprimés.
                    Si l&apos;entité possède encore des biens, la suppression sera refusée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
              {tab.id === "properties" && properties.length > 0 && (
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {properties.length}
                </span>
              )}
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
        {activeTab === "properties" && (
          <PropertiesTab
            entityId={entity.id as string}
            properties={properties}
            unassignedProperties={unassignedProperties}
            onAssigned={(prop) => {
              setProperties((prev) => [...prev, prop]);
              setUnassignedProperties((prev) =>
                prev.filter((p) => p.id !== prop.id)
              );
            }}
            onRemoved={(propertyId) => {
              const removed = properties.find((p) => p.id === propertyId);
              setProperties((prev) =>
                prev.filter((p) => p.id !== propertyId)
              );
              if (removed) {
                setUnassignedProperties((prev) => [...prev, { ...removed, legal_entity_id: null }]);
              }
            }}
          />
        )}
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
// PROPERTIES TAB
// ============================================

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  local_commercial: "Local commercial",
  bureau: "Bureau",
  parking: "Parking",
  garage: "Garage",
  terrain: "Terrain",
  immeuble: "Immeuble",
  cave: "Cave",
  autre: "Autre",
};

const DETENTION_MODE_LABELS: Record<string, string> = {
  direct: "Directe",
  societe: "Via société",
  indivision: "Indivision",
  demembrement: "Démembrement",
};

function PropertiesTab({
  entityId,
  properties,
  unassignedProperties,
  onAssigned,
  onRemoved,
}: {
  entityId: string;
  properties: Record<string, unknown>[];
  unassignedProperties: Record<string, unknown>[];
  onAssigned: (property: Record<string, unknown>) => void;
  onRemoved: (propertyId: string) => void;
}) {
  const { toast } = useToast();
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedPropertyId) return;
    setIsAssigning(true);
    try {
      const res = await fetch(
        `/api/owner/legal-entities/${entityId}/properties`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property_id: selectedPropertyId }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'affectation");
      }
      const assigned = unassignedProperties.find(
        (p) => p.id === selectedPropertyId
      );
      if (assigned) {
        onAssigned({ ...assigned, legal_entity_id: entityId });
      }
      setSelectedPropertyId("");
      toast({
        title: "Bien affecté",
        description: "Le bien a été rattaché à cette entité.",
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible d'affecter le bien.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async (propertyId: string) => {
    setRemovingId(propertyId);
    try {
      const res = await fetch(
        `/api/owner/legal-entities/${entityId}/properties?propertyId=${propertyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du retrait");
      }
      onRemoved(propertyId);
      toast({
        title: "Bien retiré",
        description: "Le bien est revenu en détention directe.",
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible de retirer le bien.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Assign property */}
      {unassignedProperties.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                className="flex h-11 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <option value="">Sélectionner un bien à affecter…</option>
                {unassignedProperties.map((p) => (
                  <option key={p.id as string} value={p.id as string}>
                    {(p.adresse_complete as string) ||
                      `${(p.ville as string) || "Bien"} ${(p.code_postal as string) || ""}`}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAssign}
                disabled={!selectedPropertyId || isAssigning}
              >
                {isAssigning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Affecter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property list */}
      {properties.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Home className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Aucun bien rattaché</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {unassignedProperties.length > 0
                ? "Utilisez le sélecteur ci-dessus pour affecter un bien à cette entité."
                : "Créez d'abord un bien, puis affectez-le à cette entité."}
            </p>
            {unassignedProperties.length === 0 && (
              <Button variant="outline" asChild>
                <Link href="/owner/properties/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un bien
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Biens détenus ({properties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {properties.map((p) => {
                const propId = p.id as string;
                const typeLabel =
                  PROPERTY_TYPE_LABELS[(p.type as string) || ""] ||
                  (p.type as string) ||
                  "Bien";
                const detentionLabel =
                  DETENTION_MODE_LABELS[
                    (p.detention_mode as string) || ""
                  ] || null;
                const loyerHc = p.loyer_hc as number | null;
                const surface = p.surface as number | null;

                return (
                  <div
                    key={propId}
                    className="flex items-center gap-3 p-3 rounded-lg border group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Home className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/owner/properties/${propId}`}
                        className="font-medium text-sm hover:underline truncate block"
                      >
                        {(p.adresse_complete as string) ||
                          `${(p.ville as string) || "Bien"} ${(p.code_postal as string) || ""}`}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabel}
                        </Badge>
                        {detentionLabel && (
                          <Badge variant="outline" className="text-xs">
                            {detentionLabel}
                          </Badge>
                        )}
                        {surface && (
                          <span className="text-xs text-muted-foreground">
                            {surface} m²
                          </span>
                        )}
                        {loyerHc != null && loyerHc > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {loyerHc.toLocaleString("fr-FR")} €/mois
                          </span>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Retirer ce bien de l&apos;entité ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Le bien reviendra en détention directe (nom propre).
                            Vous pourrez le réaffecter à une autre entité
                            ultérieurement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(propId)}
                            disabled={removingId === propId}
                          >
                            {removingId === propId ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Retrait…
                              </>
                            ) : (
                              "Retirer"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
