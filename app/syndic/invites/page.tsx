"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Building2,
  Search,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface Site {
  id: string;
  name: string;
}

interface Invite {
  id: string;
  email: string;
  site_id: string;
  site_name: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  owner_name?: string;
}

const statusConfig = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  accepted: { label: "Acceptée", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  expired: { label: "Expirée", color: "bg-slate-100 text-slate-700", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function SyndicInvitesPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedSiteId = searchParams.get("siteId");

  const [invites, setInvites] = useState<Invite[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newInvite, setNewInvite] = useState({
    email: "",
    site_id: preselectedSiteId || "",
    owner_name: "",
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [invitesRes, sitesRes] = await Promise.all([
          fetch("/api/copro/invites"),
          fetch("/api/copro/sites"),
        ]);

        if (invitesRes.ok) {
          const data = await invitesRes.json();
          setInvites(data.invites || data || []);
        }

        if (sitesRes.ok) {
          const data = await sitesRes.json();
          setSites(data.sites || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement données:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredInvites = invites.filter((invite) => {
    const matchesSearch =
      !searchQuery ||
      invite.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invite.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invite.site_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || invite.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSendInvite = async () => {
    if (!newInvite.email || !newInvite.site_id) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch("/api/copro/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInvite),
      });

      if (!response.ok) throw new Error("Erreur envoi");

      const data = await response.json();
      setInvites([data.invite || data, ...invites]);

      toast({
        title: "Invitation envoyée",
        description: `Une invitation a été envoyée à ${newInvite.email}`,
      });

      setNewInvite({ email: "", site_id: preselectedSiteId || "", owner_name: "" });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer l'invitation.",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/copro/invites/${inviteId}/resend`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Erreur renvoi");

      toast({
        title: "Invitation renvoyée",
        description: "L'invitation a été renvoyée avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de renvoyer l'invitation.",
        variant: "destructive",
      });
    }
  };

  const stats = {
    total: invites.length,
    pending: invites.filter((i) => i.status === "pending").length,
    accepted: invites.filter((i) => i.status === "accepted").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Invitations
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les invitations des copropriétaires
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Inviter un copropriétaire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un copropriétaire</DialogTitle>
              <DialogDescription>
                Envoyez une invitation par email pour rejoindre la copropriété
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="site">Site *</Label>
                <Select
                  value={newInvite.site_id}
                  onValueChange={(value) => setNewInvite({ ...newInvite, site_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  placeholder="email@exemple.fr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_name">Nom du copropriétaire</Label>
                <Input
                  id="owner_name"
                  value={newInvite.owner_name}
                  onChange={(e) => setNewInvite({ ...newInvite, owner_name: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSendInvite}
                disabled={sendingInvite}
                className="bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                {sendingInvite ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total envoyées</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acceptées</p>
                <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/80"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white/80">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="accepted">Acceptées</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-0">
            {filteredInvites.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {invites.length === 0
                    ? "Aucune invitation envoyée"
                    : "Aucun résultat trouvé"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Copropriétaire</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date d'envoi</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvites.map((invite) => {
                    const status = statusConfig[invite.status];
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invite.owner_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{invite.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {invite.site_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(status.color, "flex items-center gap-1 w-fit")}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invite.created_at), "dd/MM/yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          {invite.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(invite.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Renvoyer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

