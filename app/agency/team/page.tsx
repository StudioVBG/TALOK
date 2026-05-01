"use client";

/**
 * TeamPage - Gestion de l'équipe agence
 * SOTA 2026: Feature multi_users requiert Confort+
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Shield,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
} from "lucide-react";
import { PlanGate } from "@/components/subscription";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  kind: "member" | "invitation";
  name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
  role: string;
  propertiesCount?: number;
  status: string;
  can_sign_documents?: boolean;
  since: string;
  expires_at?: string;
};

function formatSince(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

const roleConfig = {
  directeur: { label: "Directeur", color: "bg-purple-100 text-purple-700 border-purple-300" },
  gestionnaire: { label: "Gestionnaire", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  assistant: { label: "Assistant", color: "bg-sky-100 text-sky-700 border-sky-300" },
  comptable: { label: "Comptable", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

export default function TeamPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"gestionnaire" | "assistant" | "comptable">("gestionnaire");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/agency/team");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvitations(data.invitations ?? []);
    } catch (err) {
      toast({
        title: "Impossible de charger l'équipe",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleRevoke = async (entry: TeamMember) => {
    const confirmMsg =
      entry.kind === "invitation"
        ? `Annuler l'invitation envoyée à ${entry.email} ?`
        : `Retirer ${entry.name} de l'équipe ?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/agency/team/${entry.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      toast({
        title: entry.kind === "invitation" ? "Invitation annulée" : "Membre retiré",
        description: entry.email,
      });
      await loadTeam();
    } catch (err) {
      toast({
        title: "Action échouée",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const allEntries: TeamMember[] = [...members, ...invitations];
  const filteredMembers = allEntries.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("gestionnaire");
  };

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Email invalide",
        description: "Renseignez une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/agency/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role_agence: inviteRole }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur lors de l'envoi de l'invitation");
      }

      toast({
        title: "Invitation envoyée",
        description: `Un email a été envoyé à ${email}.`,
      });
      resetInviteForm();
      setIsInviteDialogOpen(false);
      // Recharger pour afficher l'invitation pending
      loadTeam();
    } catch (error) {
      toast({
        title: "Échec de l'invitation",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PlanGate feature="multi_users" mode="blur">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Équipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les membres de votre agence
          </p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Inviter un collaborateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un collaborateur</DialogTitle>
              <DialogDescription>
                Envoyez une invitation par email pour rejoindre votre agence
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="collaborateur@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rôle</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="comptable">Comptable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetInviteForm();
                  setIsInviteDialogOpen(false);
                }}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button onClick={handleSendInvite} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-sm text-muted-foreground">Membres</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{members.filter((m) => m.role === "gestionnaire").length}</p>
              <p className="text-sm text-muted-foreground">Gestionnaires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{invitations.length}</p>
              <p className="text-sm text-muted-foreground">Invitations en attente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Chargement de l'équipe…
        </div>
      )}

      {/* Search */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => {
          const role = roleConfig[member.role as keyof typeof roleConfig];
          const isPending = member.kind === "invitation";
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border-2 border-indigo-200">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                          {member.name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{member.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {role && (
                            <Badge variant="outline" className={cn("text-xs", role.color)}>
                              {role.label}
                            </Badge>
                          )}
                          {isPending && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Invitation
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isPending && (
                          <>
                            <DropdownMenuItem disabled>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => handleRevoke(member)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {isPending ? "Annuler l'invitation" : "Retirer"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  {!isPending && (member.propertiesCount ?? 0) > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Biens assignés :</span>{" "}
                        <span className="font-semibold text-indigo-600">{member.propertiesCount}</span>
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      {isPending ? "Invité" : "Membre"} depuis {formatSince(member.since)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
    </PlanGate>
  );
}

