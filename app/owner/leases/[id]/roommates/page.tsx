// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Euro,
  Percent,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

interface Roommate {
  id: string;
  lease_id: string;
  user_id: string | null;
  email: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  payment_weight: number;
  joined_on: string;
  left_on: string | null;
  is_main_tenant: boolean;
  created_at: string;
  profile?: {
    id: string;
    prenom: string;
    nom: string;
    telephone: string;
  };
}

interface Lease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  statut: string;
  property?: {
    adresse_complete: string;
    ville: string;
  };
}

export default function RoommatesPage() {
  const params = useParams();
  const router = useRouter();
  const leaseId = params.id as string;
  const { toast } = useToast();

  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    prenom: "",
    nom: "",
    payment_weight: 100,
  });

  useEffect(() => {
    fetchData();
  }, [leaseId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Récupérer les infos du bail
      const leaseRes = await fetch(`/api/leases/${leaseId}`);
      if (!leaseRes.ok) throw new Error("Bail non trouvé");
      const leaseData = await leaseRes.json();
      setLease(leaseData.lease);

      // Récupérer les colocataires
      const roommatesRes = await fetch(`/api/leases/${leaseId}/roommates`);
      if (!roommatesRes.ok) throw new Error("Erreur lors du chargement");
      const roommatesData = await roommatesRes.json();
      setRoommates(roommatesData.roommates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);

    try {
      const res = await fetch(`/api/leases/${leaseId}/roommates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'invitation");
      }

      toast({
        title: "Invitation envoyée",
        description: `${inviteData.prenom} ${inviteData.nom} a été invité(e) à rejoindre le bail.`,
      });

      setInviteOpen(false);
      setInviteData({ email: "", prenom: "", nom: "", payment_weight: 100 });
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setInviteLoading(false);
    }
  }

  // Calculer les statistiques
  const totalWeight = roommates.reduce((sum, r) => sum + (r.payment_weight || 0), 0);
  const totalRent = (lease?.loyer || 0) + (lease?.charges_forfaitaires || 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/owner/leases/${leaseId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des colocataires</h1>
            <p className="text-muted-foreground">
              {lease?.property?.adresse_complete}, {lease?.property?.ville}
            </p>
          </div>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Inviter un colocataire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Inviter un colocataire</DialogTitle>
                <DialogDescription>
                  Envoyez une invitation par email pour qu'il rejoigne le bail.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={inviteData.prenom}
                      onChange={(e) =>
                        setInviteData({ ...inviteData, prenom: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={inviteData.nom}
                      onChange={(e) =>
                        setInviteData({ ...inviteData, nom: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteData.email}
                    onChange={(e) =>
                      setInviteData({ ...inviteData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_weight">Part de loyer (%)</Label>
                  <Input
                    id="payment_weight"
                    type="number"
                    min="0"
                    max="100"
                    value={inviteData.payment_weight}
                    onChange={(e) =>
                      setInviteData({
                        ...inviteData,
                        payment_weight: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Équivalent à {((inviteData.payment_weight / 100) * totalRent).toFixed(2)}€/mois
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer l'invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roommates.length}</p>
                <p className="text-sm text-muted-foreground">Colocataire(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <Euro className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRent.toFixed(2)}€</p>
                <p className="text-sm text-muted-foreground">Loyer total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalWeight === 100 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                <Percent className={`h-5 w-5 ${totalWeight === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWeight}%</p>
                <p className="text-sm text-muted-foreground">Répartition totale</p>
              </div>
            </div>
            {totalWeight !== 100 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ La répartition devrait être de 100%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Liste des colocataires */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des colocataires</CardTitle>
          <CardDescription>
            Gérez la répartition des loyers entre les colocataires
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roommates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Aucun colocataire</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Invitez des colocataires pour qu'ils puissent payer leur part du loyer.
              </p>
              <Button className="mt-4" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Inviter un colocataire
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colocataire</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Part</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Depuis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roommates.map((roommate) => {
                  const share = (roommate.payment_weight / 100) * totalRent;
                  const hasAccount = !!roommate.user_id;

                  return (
                    <TableRow key={roommate.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {roommate.prenom?.[0]}{roommate.nom?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {roommate.prenom} {roommate.nom}
                            </p>
                            {roommate.is_main_tenant && (
                              <Badge variant="outline" className="text-xs">
                                Locataire principal
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{roommate.email}</span>
                          </div>
                          {roommate.telephone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{roommate.telephone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{roommate.payment_weight}%</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{share.toFixed(2)}€</span>
                        <span className="text-muted-foreground">/mois</span>
                      </TableCell>
                      <TableCell>
                        {hasAccount ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Inscrit</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">En attente</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {roommate.joined_on
                            ? format(new Date(roommate.joined_on), "dd MMM yyyy", { locale: fr })
                            : "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info légale */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Colocation et solidarité
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                En colocation avec clause de solidarité, chaque colocataire peut être tenu de payer
                l'intégralité du loyer en cas de défaillance des autres. La répartition affichée
                ici est indicative et facilite le paiement individuel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

