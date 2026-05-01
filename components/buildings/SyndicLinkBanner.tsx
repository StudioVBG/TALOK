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

// (Search est déjà importé ci-dessus pour le filtre de recherche)
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Activation syndic-bénévole (full)
  const [volunteerOpen, setVolunteerOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  // Inviter un syndic externe
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    copro_name: "",
    phone: "",
    message: "",
  });

  // Unlink
  const [unlinking, setUnlinking] = useState(false);

  async function loadMatches(q: string = "") {
    setMatchesLoading(true);
    try {
      const url = q
        ? `/api/buildings/${buildingId}/match-sites?q=${encodeURIComponent(q)}`
        : `/api/buildings/${buildingId}/match-sites`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : []);
      }
    } finally {
      setMatchesLoading(false);
    }
  }

  useEffect(() => {
    if (searchOpen) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  // Debounced free-text search
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      loadMatches(searchQuery);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounce]);

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

  async function handleInviteSyndic(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.email) {
      toast({ title: "Email requis", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/invite-syndic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      setInviteResult({ url: body.invite_url });
      toast({
        title: "Invitation envoyée",
        description: `Email envoyé à ${inviteForm.email}`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInviteResult(null);
                  setInviteOpen(true);
                }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Inviter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={inviteOpen}
          onOpenChange={(o) => {
            setInviteOpen(o);
            if (!o) setInviteResult(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter mon syndic à rejoindre Talok</DialogTitle>
              <DialogDescription>
                Un email lui sera envoyé avec un lien d'inscription pré-rempli.
                Quand il créera son compte, votre immeuble sera automatiquement
                rattaché à la copropriété qu'il configurera.
              </DialogDescription>
            </DialogHeader>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-700 inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Invitation envoyée
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Vous pouvez aussi partager ce lien directement avec votre syndic :
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Input value={inviteResult.url} readOnly className="text-xs font-mono" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteResult.url);
                        toast({ title: "Copié" });
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setInviteOpen(false)}>Fermer</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleInviteSyndic} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email du syndic *</Label>
                  <Input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="contact@cabinet-syndic.fr"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom du cabinet</Label>
                    <Input
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="Cabinet Foch"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Téléphone</Label>
                    <Input
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom de la copropriété (optionnel)</Label>
                  <Input
                    value={inviteForm.copro_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, copro_name: e.target.value })}
                    placeholder="Résidence Les Magnolias"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message personnel</Label>
                  <Textarea
                    rows={3}
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    placeholder="Bonjour, je suis copropriétaire et …"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Envoyer l'invitation
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom de copro, cabinet, SIRET, carte G…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchDebounce((v) => v + 1);
                  }}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? "Recherche libre dans toute la base Talok."
                  : `Suggestions automatiques basées sur l'adresse de votre immeuble.`}
              </p>

              {matchesLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : matches.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? "Aucun résultat. Essayez un autre terme ou invitez votre syndic à rejoindre Talok."
                    : "Aucune copropriété trouvée à votre adresse. Tapez le nom de votre cabinet syndic ci-dessus pour élargir la recherche."}
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
