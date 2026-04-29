"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft,
  Briefcase,
  Plus,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
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

const CONTRACT_CATEGORY_LABELS: Record<string, string> = {
  entretien: "Entretien",
  ascenseur: "Ascenseur",
  chauffage: "Chauffage",
  plomberie: "Plomberie",
  electricite: "Électricité",
  espaces_verts: "Espaces verts",
  nettoyage: "Nettoyage",
  gardiennage: "Gardiennage",
  securite: "Sécurité",
  assurance_immeuble: "Assurance immeuble",
  expert_comptable: "Expert-comptable",
  avocat: "Avocat",
  autre: "Autre",
};

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
  on_demand: "À la demande",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  suspended: { label: "Suspendu", color: "bg-amber-100 text-amber-700", icon: Clock },
  expired: { label: "Expiré", color: "bg-slate-100 text-slate-700", icon: XCircle },
  terminated: { label: "Résilié", color: "bg-red-100 text-red-700", icon: XCircle },
};

interface Supplier {
  id: string;
  name: string;
  category: string;
  siret: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
}

interface Contract {
  id: string;
  site_id: string;
  contract_number: string | null;
  title: string;
  category: string;
  start_date: string;
  end_date: string | null;
  payment_frequency: string;
  amount_cents: number | null;
  tacit_renewal: boolean;
  status: string;
}

interface SiteSummary {
  id: string;
  name: string;
}

const EMPTY_CONTRACT_FORM = {
  site_id: "",
  contract_number: "",
  title: "",
  category: "entretien",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  duration_months: 12,
  tacit_renewal: false,
  notice_period_months: 3,
  payment_frequency: "monthly",
  amount_euros: "",
  vat_rate: "20",
  contract_pdf_url: "",
  notes: "",
};

export default function SupplierDetailPage() {
  const params = useParams();
  const supplierId = params?.id as string;
  const { toast } = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CONTRACT_FORM });

  async function loadAll() {
    setLoading(true);
    try {
      const [supplierRes, sitesRes] = await Promise.all([
        fetch(`/api/copro/suppliers/${supplierId}`),
        fetch("/api/copro/sites"),
      ]);
      if (supplierRes.ok) setSupplier(await supplierRes.json());
      if (sitesRes.ok) {
        const data = await sitesRes.json();
        setSites(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
    await loadContracts();
  }

  async function loadContracts() {
    setContractsLoading(true);
    try {
      const res = await fetch(`/api/copro/suppliers/${supplierId}/contracts`);
      if (res.ok) {
        const data = await res.json();
        setContracts(Array.isArray(data) ? data : []);
      }
    } finally {
      setContractsLoading(false);
    }
  }

  useEffect(() => {
    if (supplierId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const sitesById = useMemo(
    () => new Map(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!form.site_id || !form.title || !form.start_date) {
      toast({ title: "Site, titre et date de début requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        site_id: form.site_id,
        contract_number: form.contract_number || null,
        title: form.title.trim(),
        category: form.category,
        start_date: form.start_date,
        end_date: form.end_date || null,
        duration_months: form.duration_months || null,
        tacit_renewal: form.tacit_renewal,
        notice_period_months: form.notice_period_months,
        payment_frequency: form.payment_frequency,
        amount_cents: form.amount_euros ? Math.round(Number(form.amount_euros) * 100) : null,
        vat_rate_pct: form.vat_rate ? Number(form.vat_rate) : null,
        contract_pdf_url: form.contract_pdf_url || null,
        notes: form.notes || null,
      };
      const res = await fetch(`/api/copro/suppliers/${supplierId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({ title: "Contrat créé" });
      setDialogOpen(false);
      setForm({ ...EMPTY_CONTRACT_FORM });
      loadContracts();
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Fournisseur introuvable.</p>
        <Link href="/syndic/suppliers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/syndic/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-violet-600" />
            {supplier.name}
          </h1>
          <p className="text-muted-foreground">
            {SUPPLIER_CATEGORY_LABELS[supplier.category] ?? supplier.category}
            {supplier.siret && ` · SIRET ${supplier.siret}`}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <InfoBlock label="Contact" value={supplier.contact_name} />
            <InfoBlock
              label="Email"
              value={supplier.contact_email}
              icon={<Mail className="w-3 h-3" />}
            />
            <InfoBlock
              label="Téléphone"
              value={supplier.contact_phone}
              icon={<Phone className="w-3 h-3" />}
            />
            <InfoBlock
              label="Adresse"
              value={
                [supplier.address_line1, supplier.postal_code, supplier.city]
                  .filter(Boolean)
                  .join(", ") || null
              }
              icon={<MapPin className="w-3 h-3" />}
            />
            {supplier.notes && (
              <div className="sm:col-span-3">
                <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                  Notes
                </p>
                <p className="text-foreground whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-600" />
              Contrats ({contracts.length})
            </CardTitle>
            <CardDescription>Contrats actifs et historiques de ce fournisseur</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau contrat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouveau contrat</DialogTitle>
                <DialogDescription>
                  Rattachez un contrat à une copropriété précise.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateContract} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Copropriété *</Label>
                    <Select
                      value={form.site_id}
                      onValueChange={(v) => setForm({ ...form, site_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Titre *</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Ex : Maintenance ascenseur"
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
                        {Object.entries(CONTRACT_CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro</Label>
                    <Input
                      value={form.contract_number}
                      onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Début *</Label>
                    <Input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin (laisser vide si indéterminée)</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fréquence de paiement</Label>
                    <Select
                      value={form.payment_frequency}
                      onValueChange={(v) => setForm({ ...form, payment_frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount_euros}
                      onChange={(e) => setForm({ ...form, amount_euros: e.target.value })}
                      placeholder="500.00"
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      id="tacit_renewal"
                      type="checkbox"
                      checked={form.tacit_renewal}
                      onChange={(e) => setForm({ ...form, tacit_renewal: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="tacit_renewal" className="cursor-pointer">
                      Reconduction tacite
                    </Label>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>URL du contrat (PDF signé)</Label>
                    <Input
                      type="url"
                      value={form.contract_pdf_url}
                      onChange={(e) => setForm({ ...form, contract_pdf_url: e.target.value })}
                      placeholder="https://…"
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
                    Créer le contrat
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {contractsLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucun contrat enregistré pour ce fournisseur.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Copropriété</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const config = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.active;
                  const Icon = config.icon;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">
                        {c.title}
                        {c.contract_number && (
                          <span className="block text-xs text-muted-foreground font-mono">
                            {c.contract_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {sitesById.get(c.site_id) ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-violet-200 text-violet-700">
                          {CONTRACT_CATEGORY_LABELS[c.category] ?? c.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {new Date(c.start_date).toLocaleDateString("fr-FR")}
                        {c.end_date
                          ? ` → ${new Date(c.end_date).toLocaleDateString("fr-FR")}`
                          : " → indéterminée"}
                        {c.tacit_renewal && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-blue-200 text-blue-700 text-xs"
                          >
                            Tacite
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {c.amount_cents != null
                          ? `${(c.amount_cents / 100).toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                            })} € / ${FREQUENCY_LABELS[c.payment_frequency] ?? c.payment_frequency}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.color} border`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">{label}</p>
      <p className="text-foreground inline-flex items-center gap-1.5">
        {icon}
        {value ?? "—"}
      </p>
    </div>
  );
}
