"use client";

// =====================================================
// Section "Mes prestataires externes"
// Affiche en haut de /owner/providers les artisans Google Places /
// démo que l'utilisateur a explicitement enregistrés. Permet de les
// rappeler hors de la recherche cartographique (changement de bien,
// changement de rayon, etc.).
// =====================================================

import { useEffect, useState } from "react";
import {
  BookmarkCheck,
  Phone,
  ExternalLink,
  Star,
  MapPin,
  Trash2,
  Loader2,
  StickyNote,
  Save,
  X,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface ExternalFavorite {
  id: string;
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  google_maps_url: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}

export function ExternalFavoritesSection() {
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<ExternalFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/providers/external-favorites");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setFavorites(data?.favorites ?? []);
      } catch (err) {
        console.warn("[ExternalFavoritesSection] Erreur chargement:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = (favorite: ExternalFavorite) => {
    setEditingId(favorite.place_id);
    setDraftNotes(favorite.notes ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftNotes("");
  };

  const saveNotes = async (favorite: ExternalFavorite) => {
    setSavingNotesId(favorite.place_id);
    try {
      const res = await fetch(
        `/api/providers/external-favorites/${encodeURIComponent(favorite.place_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: draftNotes.trim() || null }),
        },
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setFavorites((prev) =>
        prev.map((f) =>
          f.place_id === favorite.place_id
            ? { ...f, notes: data?.favorite?.notes ?? null }
            : f,
        ),
      );
      setEditingId(null);
      setDraftNotes("");
      toast({
        title: "Notes enregistrées",
        description: `Vos notes sur ${favorite.name} ont été sauvegardées.`,
      });
    } catch (err) {
      console.error("[ExternalFavoritesSection] Erreur notes:", err);
      toast({
        title: "Sauvegarde impossible",
        description: "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setSavingNotesId(null);
    }
  };

  const remove = async (favorite: ExternalFavorite) => {
    setRemovingId(favorite.place_id);
    try {
      const res = await fetch(
        `/api/providers/external-favorites/${encodeURIComponent(favorite.place_id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      setFavorites((prev) => prev.filter((f) => f.place_id !== favorite.place_id));
      toast({
        title: "Prestataire retiré",
        description: `${favorite.name} a été retiré de vos favoris.`,
      });
    } catch (err) {
      console.error("[ExternalFavoritesSection] Erreur suppression:", err);
      toast({
        title: "Suppression impossible",
        description: "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return null;
  if (favorites.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-emerald-600" />
          Mes prestataires externes
          <Badge variant="secondary">{favorites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {favorites.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border p-3 space-y-2 bg-card hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{f.name}</div>
                  {f.address && (
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {f.address}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(f)}
                  disabled={removingId === f.place_id}
                  title="Retirer des favoris"
                >
                  {removingId === f.place_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {f.category && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {f.category}
                  </Badge>
                )}
                {f.rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {f.rating.toFixed(1)}
                    {f.reviews_count != null && (
                      <span className="text-muted-foreground">
                        ({f.reviews_count})
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {f.phone && (
                  <a
                    href={`tel:${f.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {f.phone}
                  </a>
                )}
                {f.website && (
                  <a
                    href={f.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    Site web
                  </a>
                )}
                {f.google_maps_url && (
                  <a
                    href={f.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Maps
                  </a>
                )}
              </div>

              {/* Notes — affichage et édition inline */}
              {editingId === f.place_id ? (
                <div className="space-y-2 pt-2 border-t">
                  <Textarea
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Ex. Recommandé par le voisin du 1er, intervient sous 24h."
                    rows={2}
                    maxLength={2000}
                    className="text-xs"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={cancelEdit}
                      disabled={savingNotesId === f.place_id}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => saveNotes(f)}
                      disabled={
                        savingNotesId === f.place_id ||
                        draftNotes === (f.notes ?? "")
                      }
                    >
                      {savingNotesId === f.place_id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : f.notes ? (
                <button
                  type="button"
                  onClick={() => startEdit(f)}
                  className="w-full text-left rounded-md bg-muted/40 border border-dashed p-2 text-xs italic text-muted-foreground hover:bg-muted/70 transition-colors flex gap-1.5"
                  title="Cliquer pour modifier"
                >
                  <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{f.notes}</span>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground justify-start"
                  onClick={() => startEdit(f)}
                >
                  <StickyNote className="h-3 w-3 mr-1.5" />
                  Ajouter une note
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ExternalFavoritesSection;
