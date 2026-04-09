"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Settings,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  useSeasonalListing,
  useUpdateListing,
  useDeleteListing,
} from "@/features/seasonal/hooks/use-seasonal";
import { RateEditor } from "@/features/seasonal/components/RateEditor";
import { SyncStatusBadge } from "@/features/seasonal/components/SyncStatusBadge";
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
import { SeasonalGate } from "../../SeasonalGate";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading } = useSeasonalListing(id);
  const updateListing = useUpdateListing(id);
  const deleteListing = useDeleteListing();

  const listing = data?.listing;

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);

  function handleChange(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }

  function getValue<T>(field: string, fallback: T): T {
    return (form[field] as T) ?? (listing as Record<string, unknown>)?.[field] as T ?? fallback;
  }

  async function handleSave() {
    if (!isDirty) return;
    try {
      await updateListing.mutateAsync(form);
      toast({ title: "Annonce mise à jour" });
      setIsDirty(false);
      setForm({});
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteListing.mutateAsync(id);
      toast({ title: "Annonce supprimée" });
      router.push("/owner/seasonal");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  async function handleTogglePublish() {
    const newValue = !getValue("is_published", false);
    try {
      await updateListing.mutateAsync({ is_published: newValue });
      toast({ title: newValue ? "Annonce publiée" : "Annonce dépubliée" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Annonce non trouvée</p>
        <Link href="/owner/seasonal">
          <Button variant="outline" className="mt-4">Retour</Button>
        </Link>
      </div>
    );
  }

  return (
    <SeasonalGate>
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/owner/seasonal">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {getValue("title", listing.title)}
            </h1>
            {listing.property && (
              <p className="text-sm text-muted-foreground">
                {listing.property.adresse_complete}, {listing.property.ville}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusBadge listingId={id} />
          <Button variant="outline" size="sm" onClick={handleTogglePublish}>
            {getValue("is_published", false) ? (
              <><EyeOff className="h-4 w-4 mr-1" /> Dépublier</>
            ) : (
              <><Eye className="h-4 w-4 mr-1" /> Publier</>
            )}
          </Button>
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={updateListing.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {updateListing.isPending ? "..." : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>

      {/* Listing settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Paramètres de l&apos;annonce
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input
                value={getValue("title", "")}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max voyageurs</label>
              <Input
                type="number"
                min="1"
                value={getValue("max_guests", 4)}
                onChange={(e) => handleChange("max_guests", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Min nuits</label>
              <Input
                type="number"
                min="1"
                value={getValue("min_nights", 1)}
                onChange={(e) => handleChange("min_nights", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max nuits</label>
              <Input
                type="number"
                min="1"
                value={getValue("max_nights", 90)}
                onChange={(e) => handleChange("max_nights", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Heure check-in</label>
              <Input
                type="time"
                value={getValue("check_in_time", "15:00")}
                onChange={(e) => handleChange("check_in_time", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Heure check-out</label>
              <Input
                type="time"
                value={getValue("check_out_time", "11:00")}
                onChange={(e) => handleChange("check_out_time", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Frais de ménage (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(getValue("cleaning_fee_cents", 0) / 100).toFixed(2)}
                onChange={(e) => handleChange("cleaning_fee_cents", Math.round(parseFloat(e.target.value) * 100))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Caution (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(getValue("security_deposit_cents", 0) / 100).toFixed(2)}
                onChange={(e) => handleChange("security_deposit_cents", Math.round(parseFloat(e.target.value) * 100))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Taxe de séjour / nuit (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(getValue("tourist_tax_per_night_cents", 0) / 100).toFixed(2)}
                onChange={(e) => handleChange("tourist_tax_per_night_cents", Math.round(parseFloat(e.target.value) * 100))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              rows={4}
              value={getValue("description", "")}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Règlement intérieur</label>
            <Textarea
              rows={3}
              value={getValue("house_rules", "")}
              onChange={(e) => handleChange("house_rules", e.target.value)}
              placeholder="Ex: pas de fête, pas de fumée..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Rates */}
      <RateEditor listingId={id} />

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Supprimer cette annonce</p>
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer l&apos;annonce ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera définitivement l&apos;annonce et tous les tarifs associés.
                    Les réservations existantes seront conservées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
    </SeasonalGate>
  );
}
