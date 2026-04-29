"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Mail,
  Phone,
  Star,
  Loader2,
  Archive,
  ChevronRight,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  entretien: "Entretien",
  ascenseur: "Ascenseur",
  chauffage: "Chauffage",
  plomberie: "Plomberie",
  electricite: "Électricité",
  espaces_verts: "Espaces verts",
  nettoyage: "Nettoyage",
  gardiennage: "Gardiennage",
  securite: "Sécurité",
  assurance: "Assurance",
  expert_comptable: "Expert-comptable",
  avocat: "Avocat",
  architecte: "Architecte",
  travaux_batiment: "Travaux bâtiment",
  autre: "Autre",
};

interface Supplier {
  id: string;
  name: string;
  category: string;
  siret: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  rating: number | null;
  status: "active" | "archived";
}

const EMPTY_FORM = {
  name: "",
  category: "entretien",
  siret: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address_line1: "",
  postal_code: "",
  city: "",
  notes: "",
};

export default function SyndicSuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/copro/suppliers?status=active");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        siret: form.siret ? form.siret.replace(/\s/g, "") : null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        address_line1: form.address_line1 || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/copro/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({ title: "Fournisseur ajouté" });
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archiver ce fournisseur ?")) return;
    try {
      const res = await fetch(`/api/copro/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur");
      }
      toast({ title: "Fournisseur archivé" });
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    }
  }

  const filtered =
    filter === "all" ? suppliers : suppliers.filter((s) => s.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-violet-600" />
            Fournisseurs
          </h1>
          <p className="text-muted-foreground">
            Carnet de fournisseurs et contrats des copropriétés
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Nouveau fournisseur</DialogTitle>
                <DialogDescription>
                  Ajoutez un fournisseur à votre carnet (réutilisable sur toutes vos copropriétés).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nom / Raison sociale *</Label>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Société ABC Ascenseurs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie *</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>SIRET</Label>
                    <Input
                      value={form.siret}
                      onChange={(e) =>
                        setForm({ ...form, siret: e.target.value.replace(/\s/g, "") })
                      }
                      placeholder="12345678900012"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input
                      value={form.contact_name}
                      onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.contact_email}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                      placeholder="contact@fournisseur.fr"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Téléphone</Label>
                    <Input
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      placeholder="01 23 45 67 89"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Adresse</Label>
                    <Input
                      value={form.address_line1}
                      onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code postal</Label>
                    <Input
                      value={form.postal_code}
                      onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">Aucun fournisseur pour le moment</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter votre premier fournisseur
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/syndic/suppliers/${s.id}`}
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-violet-200 text-violet-700">
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground text-sm">
                      <div className="flex flex-col gap-0.5">
                        {s.contact_name && <span>{s.contact_name}</span>}
                        {s.contact_email && (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {s.contact_email}
                          </span>
                        )}
                        {s.contact_phone && (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {s.contact_phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.city ?? "—"}</TableCell>
                    <TableCell>
                      {s.rating != null ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-600">
                          {Array.from({ length: s.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/syndic/suppliers/${s.id}`}>
                          <Button size="sm" variant="ghost" title="Voir les contrats">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(s.id)}
                          title="Archiver"
                        >
                          <Archive className="h-4 w-4" />
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
    </div>
  );
}
