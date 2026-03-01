"use client";

/**
 * EntityDetailClient — Fiche détaillée d'une entité avec 6 onglets
 */

import { useState, useEffect } from "react";
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
  Loader2,
  Home,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { deleteEntity, deactivateEntity } from "../actions";
import { getEntityTypeLabel } from "@/lib/entities/entity-constants";
import { createClient } from "@/lib/supabase/client";

// ============================================
// TYPES
// ============================================

interface EntityDetailClientProps {
  entity: Record<string, unknown>;
  associates: Record<string, unknown>[];
}

type TabId = "info" | "patrimoine" | "bank" | "stripe" | "associates" | "documents";

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: "info", label: "Infos", icon: Info },
  { id: "patrimoine", label: "Patrimoine", icon: Home },
  { id: "bank", label: "Bancaire", icon: CreditCard },
  { id: "stripe", label: "Stripe", icon: CreditCard },
  { id: "associates", label: "Associés", icon: Users },
  { id: "documents", label: "Documents", icon: FileText },
];

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
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
        setDeleteError(result.error || "Une erreur est survenue.");
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

  const handleDeactivate = async () => {
    setIsDeleting(true);
    try {
      const result = await deactivateEntity({ id: entity.id as string });
      if (result.success) {
        removeEntity(entity.id as string);
        toast({
          title: "Entité désactivée",
          description: `${entity.nom as string} a été désactivée. Elle n'apparaîtra plus dans les sélecteurs.`,
        });
        router.push("/owner/entities");
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Impossible de désactiver.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de désactiver l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const entityType = (entity.entity_type as string) || "sci_ir";
  const typeLabel = getEntityTypeLabel(entityType);
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
                    {deleteError ? (
                      <>
                        <span className="text-destructive font-medium block mb-2">{deleteError}</span>
                        Vous pouvez <strong>désactiver</strong> l&apos;entité à la place.
                        Elle ne sera plus visible dans les sélecteurs mais restera consultable.
                      </>
                    ) : (
                      <>
                        Vous êtes sur le point de supprimer <strong>{entity.nom as string}</strong>.
                        Cette action est irréversible. Les associés liés seront également supprimés.
                        Si l&apos;entité possède encore des biens ou baux actifs, la suppression sera refusée.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteError(null)}>Annuler</AlertDialogCancel>
                  {deleteError ? (
                    <AlertDialogAction
                      onClick={handleDeactivate}
                      disabled={isDeleting}
                      className="bg-amber-600 text-white hover:bg-amber-700"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Désactivation...
                        </>
                      ) : (
                        "Désactiver l'entité"
                      )}
                    </AlertDialogAction>
                  ) : (
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
                  )}
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
        {activeTab === "patrimoine" && (
          <PatrimoineTab entityId={entity.id as string} entityType={entityType} />
        )}
        {activeTab === "bank" && <BankTab entity={entity} />}
        {activeTab === "stripe" && <StripeTab />}
        {activeTab === "associates" && (
          <AssociatesTab associates={associates} />
        )}
        {activeTab === "documents" && <DocumentsTab entityId={entity.id as string} />}
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
            value={getEntityTypeLabel((entity.entity_type as string) ?? "")}
          />
          <InfoRow
            label="Régime fiscal"
            value={
              {
                ir: "Impôt sur le Revenu (IR)",
                is: "Impôt sur les Sociétés (IS)",
                ir_option_is: "IR avec option IS",
                is_option_ir: "IS avec option IR",
              }[(entity.regime_fiscal as string) ?? ""] ?? (entity.regime_fiscal as string)
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
          {entity.nombre_parts && (
            <InfoRow
              label="Nombre de parts"
              value={`${Number(entity.nombre_parts).toLocaleString("fr-FR")} parts`}
            />
          )}
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
                  {[String(a.prenom ?? ""), String(a.nom ?? "")].filter(Boolean).join(" ") ||
                    "Associé"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {Boolean(a.is_gerant) && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Gérant
                    </Badge>
                  )}
                  {a.pourcentage_capital != null && (
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

interface EntityDocument {
  id: string;
  type: string;
  nom: string;
  created_at: string;
  property_id: string | null;
  lease_id: string | null;
  url: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  changed_fields: Record<string, { old?: string; new?: string }> | null;
  created_at: string;
}

function DocumentsTab({ entityId }: { entityId: string }) {
  const [documents, setDocuments] = useState<EntityDocument[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      setIsLoadingDocs(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("documents")
          .select("id, type, nom, created_at, property_id, lease_id, url")
          .eq("entity_id", entityId)
          .order("created_at", { ascending: false })
          .limit(50);

        setDocuments((data || []) as EntityDocument[]);
      } catch {
        // silently fail - documents tab just shows empty
      } finally {
        setIsLoadingDocs(false);
      }
    }

    async function fetchAuditLog() {
      setIsLoadingAudit(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("entity_audit_log")
          .select("id, action, changed_fields, created_at")
          .eq("entity_id", entityId)
          .order("created_at", { ascending: false })
          .limit(20);

        setAuditLog((data || []) as AuditLogEntry[]);
      } catch {
        // silently fail
      } finally {
        setIsLoadingAudit(false);
      }
    }

    fetchDocuments();
    fetchAuditLog();
  }, [entityId]);

  const ACTION_LABELS: Record<string, string> = {
    create: "Cr\u00e9ation",
    update: "Modification",
    delete: "Suppression",
    deactivate: "D\u00e9sactivation",
    reactivate: "R\u00e9activation",
  };

  const FIELD_LABELS: Record<string, string> = {
    nom: "Raison sociale",
    entity_type: "Type d'entit\u00e9",
    forme_juridique: "Forme juridique",
    regime_fiscal: "R\u00e9gime fiscal",
    siret: "SIRET",
    adresse_siege: "Adresse",
    code_postal_siege: "Code postal",
    ville_siege: "Ville",
    capital_social: "Capital social",
    iban: "IBAN",
    is_active: "Statut",
  };

  return (
    <div className="space-y-6">
      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDocs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun document li\u00e9 \u00e0 cette entit\u00e9.
                Les baux, quittances et \u00e9tats des lieux appara\u00eetront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.nom || doc.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {doc.url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        Voir
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des modifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des modifications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingAudit ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune modification enregistr\u00e9e.
            </p>
          ) : (
            <div className="space-y-3">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </p>
                    {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                        {Object.entries(entry.changed_fields).map(
                          ([field, change]) => (
                            <p key={field}>
                              {FIELD_LABELS[field] || field}
                              {change && typeof change === "object" && "old" in change && "new" in change
                                ? ` : ${change.old || "vide"} \u2192 ${change.new || "vide"}`
                                : ""}
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// PATRIMOINE TAB
// ============================================

interface EntityProperty {
  id: string;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    type: string;
    loyer_hc: number | null;
    surface: number | null;
  } | null;
  detention_type: string;
  quote_part_numerateur: number;
  quote_part_denominateur: number;
  pourcentage_detention: number | null;
  date_acquisition: string | null;
  mode_acquisition: string | null;
  prix_acquisition: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  parking: "Parking",
  box: "Box / Garage",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  fonds_de_commerce: "Fonds de commerce",
  immeuble: "Immeuble",
};

const DETENTION_LABELS: Record<string, string> = {
  pleine_propriete: "Pleine propriété",
  nue_propriete: "Nue-propriété",
  usufruit: "Usufruit",
  usufruit_temporaire: "Usufruit temporaire",
  indivision: "Indivision",
};

function PatrimoineTab({ entityId, entityType }: { entityId: string; entityType: string }) {
  const [properties, setProperties] = useState<EntityProperty[]>([]);
  const [totals, setTotals] = useState({ count: 0, totalValue: 0, monthlyRent: 0, totalSurface: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/owner/legal-entities/${entityId}/properties`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Erreur de chargement");
        }
        const data = await res.json();
        setProperties(data.properties || []);
        setTotals(data.totals || { count: 0, totalValue: 0, monthlyRent: 0, totalSurface: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProperties();
  }, [entityId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="font-medium">Erreur</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Home className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun bien rattaché</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {entityType === "particulier"
              ? "Vos biens détenus en nom propre apparaîtront ici une fois affectés."
              : "Affectez des biens à cette entité depuis la page de gestion des biens."}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/owner/properties">
              Voir mes biens
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Totaux */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Biens</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Valeur d&apos;acquisition</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Loyers mensuels</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.monthlyRent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Surface totale</p>
            <p className="text-2xl font-bold">{totals.totalSurface} m&sup2;</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des biens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Biens détenus ({properties.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {properties.map((p) => {
              const prop = p.property;
              if (!prop) return null;
              const detentionLabel = DETENTION_LABELS[p.detention_type] || p.detention_type;
              const isPartial = p.quote_part_numerateur !== p.quote_part_denominateur;

              return (
                <Link
                  key={p.id}
                  href={`/owner/properties/${prop.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {prop.adresse_complete}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {TYPE_LABELS[prop.type] || prop.type}
                      </span>
                      {prop.ville && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {prop.ville}
                        </span>
                      )}
                      {prop.surface && (
                        <span className="text-xs text-muted-foreground">
                          {prop.surface} m&sup2;
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">
                      {prop.loyer_hc ? formatCurrency(prop.loyer_hc) : "—"}
                      <span className="text-xs text-muted-foreground font-normal">/mois</span>
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {detentionLabel}
                      </Badge>
                      {isPartial && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {p.quote_part_numerateur}/{p.quote_part_denominateur}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
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
