"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Sparkles,
  Loader2,
  Link2,
  Link2Off,
  Mail,
} from "lucide-react";
import Link from "next/link";

type LinkStatus = "unlinked" | "pending" | "linked" | "rejected";
type OwnershipType = "full" | "partial";

interface MatchedSite {
  id: string;
  name: string;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
}

interface LinkedSiteSummary {
  id: string;
  name: string;
}

export interface SyndicLinkBannerProps {
  buildingId: string;
  ownershipType: OwnershipType;
  initialStatus: LinkStatus;
  linkedSite?: LinkedSiteSummary | null;
  rejectedReason?: string | null;
}

export function SyndicLinkBanner({
  buildingId,
  ownershipType,
  initialStatus,
  linkedSite,
  rejectedReason,
}: SyndicLinkBannerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<LinkStatus>(initialStatus);
  const [site, setSite] = useState<LinkedSiteSummary | null>(linkedSite ?? null);

  // Recherche / claim
  const [searchOpen, setSearchOpen] = useState(false);
  const [matches, setMatches] = useState<MatchedSite[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Activation syndic-bénévole (full)
  const [volunteerOpen, setVolunteerOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  // Unlink
  const [unlinking, setUnlinking] = useState(false);

  async function loadMatches() {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/match-sites`);
      if (res.ok) {
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : []);
      }
    } finally {
      setMatchesLoading(false);
    }
  }

  useEffect(() => {
    if (searchOpen && matches.length === 0) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  async function handleClaim() {
    if (!selectedSiteId) {
      toast({ title: "Sélectionnez une copropriété", variant: "destructive" });
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/claim-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: selectedSiteId,
          message: claimMessage || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({
        title: "Demande envoyée",
        description: "Le syndic recevra votre demande et la validera depuis son espace.",
      });
      setSearchOpen(false);
      setStatus("pending");
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  }

  async function handleUnlink() {
    if (!confirm("Confirmer la rupture du lien avec la copropriété ?")) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/unlink-site`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur");
      toast({ title: "Lien rompu" });
      setStatus("unlinked");
      setSite(null);
      router.refresh();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  }

  async function handleActivateVolunteer() {
    setActivating(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/activate-as-syndic`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({
        title: "Mode syndic-bénévole activé",
        description: "Vous pouvez maintenant gérer cet immeuble depuis l'espace syndic.",
      });
      setVolunteerOpen(false);
      router.push(`/syndic/sites/${body.site_id}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rendu
  // ────────────────────────────────────────────────────────────────────────

  // Status: linked
  if (status === "linked" && site) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Connecté à la copropriété <span className="text-emerald-700 dark:text-emerald-400">{site.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Vous accédez en lecture seule aux AG, appels de fonds, PV et documents officiels.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/syndic/sites/${site.id}`}>
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Voir l'espace copro
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUnlink}
              disabled={unlinking}
              title="Rompre le lien"
            >
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status: pending
  if (status === "pending") {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Demande envoyée</p>
              <p className="text-xs text-muted-foreground">
                Le syndic doit valider votre rattachement depuis son espace Talok.
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleUnlink} disabled={unlinking}>
            {unlinking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Annuler
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Status: rejected
  if (status === "rejected") {
    return (
      <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Demande refusée</p>
              <p className="text-xs text-muted-foreground">
                {rejectedReason ?? "Le syndic a refusé votre demande de rattachement."}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
            <Search className="w-4 h-4 mr-2" />
            Renvoyer une demande
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Status: unlinked — affichage différent selon ownership_type
  if (ownershipType === "partial") {
    return (
      <>
        <Card className="border-cyan-200 bg-cyan-50/40 dark:border-cyan-800 dark:bg-cyan-900/20">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Votre syndic est-il sur Talok ?
                </p>
                <p className="text-xs text-muted-foreground">
                  Connectez-vous à votre copropriété pour suivre AG, appels de fonds et documents officiels.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={() => setSearchOpen(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Rechercher mon syndic
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`mailto:?subject=Inviter%20mon%20syndic%20sur%20Talok&body=Bonjour,%0A%0AJe%20souhaiterais%20que%20vous%20rejoigniez%20Talok%20pour%20faciliter%20la%20gestion%20de%20notre%20copropri%C3%A9t%C3%A9.%0A%0AInscription%20:%20https://talok.fr/auth/signup?role=syndic`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Inviter
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Rechercher mon syndic</DialogTitle>
              <DialogDescription>
                Sélectionnez la copropriété à laquelle vous souhaitez vous rattacher.
                Le syndic recevra votre demande et devra la valider.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {matchesLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : matches.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucune copropriété trouvée à votre adresse. Invitez votre syndic à
                  rejoindre Talok ou contactez le support.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {matches.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSiteId === m.id
                          ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="site"
                        checked={selectedSiteId === m.id}
                        onChange={() => setSelectedSiteId(m.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.address_line1}
                          {m.postal_code && ` · ${m.postal_code} ${m.city}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {matches.length > 0 && (
                <div className="space-y-2">
                  <Label>Message au syndic (optionnel)</Label>
                  <Textarea
                    rows={2}
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    placeholder="Précisez vos lots ou références…"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSearchOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleClaim} disabled={claiming || !selectedSiteId}>
                {claiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Envoyer la demande
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ownership_type = 'full' & unlinked → option discrète
  return (
    <>
      <Card className="border-dashed border-slate-200 dark:border-slate-700">
        <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Vous êtes propriétaire unique. Aucun syndic n'est requis.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-violet-600 hover:text-violet-700"
            onClick={() => setVolunteerOpen(true)}
          >
            Activer le mode syndic-bénévole
          </Button>
        </CardContent>
      </Card>

      <Dialog open={volunteerOpen} onOpenChange={setVolunteerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer le mode syndic-bénévole</DialogTitle>
            <DialogDescription>
              Vous êtes l'unique propriétaire de cet immeuble. Légalement, aucun
              syndic n'est requis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Activez ce mode uniquement si vous souhaitez :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tenir une comptabilité dédiée par immeuble (plan comptable copropriété)</li>
              <li>Centraliser vos contrats fournisseurs (entretien, ascenseur, assurance)</li>
              <li>Émettre des appels de provisions vers vos SCI ou co-investisseurs</li>
              <li>Convoquer des réunions d'information avec vos locataires</li>
            </ul>
            <Badge variant="outline" className="border-amber-200 text-amber-700">
              Cette action peut être annulée à tout moment.
            </Badge>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVolunteerOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleActivateVolunteer} disabled={activating}>
              {activating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
