"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Send,
  Eye,
  Edit,
  Trash2,
  Euro,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { PageTransition } from "@/components/ui/page-transition";

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  description?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  invoice_date: string;
  due_date?: string;
  paid_date?: string;
  status: "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled" | "disputed";
  owner_profile_id: string;
  property_id?: string;
  work_order_id?: string;
  created_at: string;
  owner_name?: string;
  property_address?: string;
  pdf_url?: string;
}

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  estimated_cost: number;
  final_cost?: number;
  property_id: string;
  property_address: string;
  owner_profile_id: string;
  owner_name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800", icon: FileText },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-800", icon: Send },
  viewed: { label: "Vue", color: "bg-purple-100 text-purple-800", icon: Eye },
  paid: { label: "Payée", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  overdue: { label: "En retard", color: "bg-red-100 text-red-800", icon: AlertCircle },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600", icon: Trash2 },
  disputed: { label: "Contestée", color: "bg-amber-100 text-amber-800", icon: AlertCircle },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProviderInvoicesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string>("");
  
  // Form state
  const [newInvoice, setNewInvoice] = useState({
    work_order_id: "",
    title: "",
    description: "",
    items: [{ description: "", quantity: 1, unit_price: 0 }],
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;
      setCurrentProfileId(profile.id);

      // Récupérer les factures
      const { data: invoicesData } = await supabase
        .from("provider_invoices")
        .select(`
          *,
          owner:profiles!provider_invoices_owner_profile_id_fkey (
            prenom,
            nom
          ),
          property:properties (
            adresse_complete,
            ville
          )
        `)
        .eq("provider_profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (invoicesData) {
        setInvoices(invoicesData.map((inv: any) => ({
          ...inv,
          owner_name: inv.owner ? `${inv.owner.prenom || ""} ${inv.owner.nom || ""}`.trim() : "",
          property_address: inv.property ? `${inv.property.adresse_complete}, ${inv.property.ville}` : "",
        })));
      }

      // Récupérer les interventions terminées pour créer des factures
      const { data: workOrdersData } = await supabase
        .from("work_orders")
        .select(`
          *,
          ticket:tickets (
            titre,
            description,
            properties!inner (
              id,
              adresse_complete,
              ville,
              owner_id
            )
          )
        `)
        .eq("provider_id", profile.id)
        .eq("statut", "done");

      if (workOrdersData) {
        setWorkOrders(workOrdersData.map((wo: any) => ({
          id: wo.id,
          title: wo.ticket?.titre || "Intervention",
          description: wo.ticket?.description || "",
          estimated_cost: wo.cout_estime || 0,
          final_cost: wo.cout_final,
          property_id: wo.ticket?.properties?.id,
          property_address: wo.ticket?.properties 
            ? `${wo.ticket.properties.adresse_complete}, ${wo.ticket.properties.ville}` 
            : "",
          owner_profile_id: wo.ticket?.properties?.owner_id,
          owner_name: "",
        })));
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.title || newInvoice.items.every(i => !i.description)) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedWorkOrder = workOrders.find(wo => wo.id === newInvoice.work_order_id);
      
      // Créer la facture
      const { data: invoice, error: invoiceError } = await supabase
        .from("provider_invoices")
        .insert({
          provider_profile_id: currentProfileId,
          owner_profile_id: selectedWorkOrder?.owner_profile_id,
          property_id: selectedWorkOrder?.property_id,
          work_order_id: newInvoice.work_order_id || null,
          title: newInvoice.title,
          description: newInvoice.description,
          tax_rate: 20,
          status: "draft",
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Créer les lignes
      const items = newInvoice.items
        .filter(item => item.description && item.unit_price > 0)
        .map((item, index) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: 20,
          sort_order: index,
        }));

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("provider_invoice_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Facture créée",
        description: `Facture ${invoice.invoice_number} créée avec succès`,
      });

      setCreateDialogOpen(false);
      setNewInvoice({
        work_order_id: "",
        title: "",
        description: "",
        items: [{ description: "", quantity: 1, unit_price: 0 }],
      });
      fetchData();
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la facture",
        variant: "destructive",
      });
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from("provider_invoices")
        .update({ 
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (error) throw error;

      toast({
        title: "Facture envoyée",
        description: "Le propriétaire a été notifié",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la facture",
        variant: "destructive",
      });
    }
  };

  const addInvoiceItem = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, { description: "", quantity: 1, unit_price: 0 }],
    });
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const items = [...newInvoice.items];
    items[index] = { ...items[index], [field]: value };
    setNewInvoice({ ...newInvoice, items });
  };

  const removeInvoiceItem = (index: number) => {
    if (newInvoice.items.length > 1) {
      setNewInvoice({
        ...newInvoice,
        items: newInvoice.items.filter((_, i) => i !== index),
      });
    }
  };

  const calculateTotal = () => {
    const subtotal = newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = subtotal * 0.2;
    return { subtotal, tax, total: subtotal + tax };
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.title?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.owner_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === "draft").length,
    pending: invoices.filter(i => ["sent", "viewed"].includes(i.status)).length,
    paid: invoices.filter(i => i.status === "paid").length,
    totalAmount: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.total_amount, 0),
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-6 space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mes factures</h1>
            <p className="text-muted-foreground">
              Gérez vos factures d'intervention
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une facture</DialogTitle>
                <DialogDescription>
                  Créez une facture pour une intervention terminée
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {workOrders.length > 0 && (
                  <div className="space-y-2">
                    <Label>Lier à une intervention (optionnel)</Label>
                    <Select
                      value={newInvoice.work_order_id}
                      onValueChange={(value) => {
                        const wo = workOrders.find(w => w.id === value);
                        setNewInvoice({
                          ...newInvoice,
                          work_order_id: value,
                          title: wo?.title || newInvoice.title,
                          items: wo?.final_cost || wo?.estimated_cost
                            ? [{ description: wo.title, quantity: 1, unit_price: wo.final_cost || wo.estimated_cost }]
                            : newInvoice.items,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une intervention" />
                      </SelectTrigger>
                      <SelectContent>
                        {workOrders.map(wo => (
                          <SelectItem key={wo.id} value={wo.id}>
                            {wo.title} - {wo.property_address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">Titre de la facture *</Label>
                  <Input
                    id="title"
                    value={newInvoice.title}
                    onChange={(e) => setNewInvoice({ ...newInvoice, title: e.target.value })}
                    placeholder="Ex: Intervention plomberie"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newInvoice.description}
                    onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                    placeholder="Détails de l'intervention..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Lignes de facture</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  
                  {newInvoice.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateInvoiceItem(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qté"
                          value={item.quantity}
                          onChange={(e) => updateInvoiceItem(index, "quantity", parseFloat(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Prix HT"
                          value={item.unit_price || ""}
                          onChange={(e) => updateInvoiceItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => removeInvoiceItem(index)}
                          disabled={newInvoice.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total HT</span>
                    <span>{formatCurrency(calculateTotal().subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>TVA (20%)</span>
                    <span>{formatCurrency(calculateTotal().tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total TTC</span>
                    <span>{formatCurrency(calculateTotal().total)}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateInvoice}>
                  Créer la facture
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total factures</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Brouillons</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Encaissé</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalAmount)}</p>
                </div>
                <Euro className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters & Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium">Aucune facture</p>
                  <p className="text-muted-foreground">
                    {search || statusFilter !== "all" 
                      ? "Aucun résultat pour ces critères"
                      : "Créez votre première facture"}
                  </p>
                </div>
              ) : (
                <>
                <div className="md:hidden space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                    const StatusIcon = status.icon;
                    return (
                      <div key={invoice.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{invoice.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</p>
                            {invoice.property_address && <p className="text-xs text-muted-foreground truncate">{invoice.property_address}</p>}
                          </div>
                          <Badge className={status.color}><StatusIcon className="h-3 w-3 mr-1" />{status.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{invoice.owner_name || "-"}</span>
                          <span className="text-muted-foreground">{formatDateShort(invoice.invoice_date)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
                          <div className="flex items-center gap-1">
                            {invoice.status === "draft" && <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice.id)}><Send className="h-4 w-4" /></Button>}
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            {invoice.pdf_url && <Button variant="ghost" size="sm" asChild><a href={invoice.pdf_url} download><Download className="h-4 w-4" /></a></Button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invoice.title}</p>
                              {invoice.property_address && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {invoice.property_address}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{invoice.owner_name || "-"}</TableCell>
                          <TableCell>{formatDateShort(invoice.invoice_date)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(invoice.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invoice.status === "draft" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendInvoice(invoice.id)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {invoice.pdf_url && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.pdf_url} download>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}

