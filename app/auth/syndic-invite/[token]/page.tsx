"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface InvitationData {
  id: string;
  status: string;
  expires_at: string;
  suggested_syndic_name: string | null;
  suggested_syndic_email: string | null;
  suggested_syndic_phone: string | null;
  suggested_copro_name: string | null;
  message: string | null;
  building: {
    name: string | null;
    adresse_complete: string | null;
    code_postal: string | null;
    ville: string | null;
    total_lots_in_building: number | null;
  };
  invited_by: {
    prenom: string | null;
    nom: string | null;
  } | null;
}

export default function SyndicInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params?.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/syndic-invite/${token}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Invitation invalide");
        } else {
          setInvitation(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Vérifie si l'utilisateur est connecté pour adapter le CTA
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/profile")
      .then((res) => {
        if (cancelled) return;
        setAuthed(res.ok);
      })
      .catch(() => !cancelled && setAuthed(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAcceptAfterAuth() {
    setClaiming(true);
    try {
      const res = await fetch(`/api/syndic-invite/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast({ title: "Copropriété créée", description: "Vous êtes redirigé vers votre espace." });
      router.push(`/syndic/sites/${data.site_id}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <p className="text-foreground font-semibold">Invitation invalide</p>
            <p className="text-muted-foreground text-sm mt-2">
              {error ?? "Ce lien d'invitation n'est pas valide ou a expiré."}
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-6">
                Retour à l'accueil
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inviterName = invitation.invited_by
    ? [invitation.invited_by.prenom, invitation.invited_by.nom]
        .filter(Boolean)
        .join(" ") || "Un copropriétaire"
    : "Un copropriétaire";

  const buildingDisplay =
    invitation.building.name ?? invitation.building.adresse_complete ?? "un immeuble";

  const signupUrl = invitation.suggested_syndic_email
    ? `/auth/signup?role=syndic&email=${encodeURIComponent(invitation.suggested_syndic_email)}&invite_token=${token}`
    : `/auth/signup?role=syndic&invite_token=${token}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Vous êtes invité sur Talok
          </h1>
          <p className="text-muted-foreground mt-2">
            <strong>{inviterName}</strong> vous propose de gérer sa copropriété sur Talok.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              La copropriété concernée
            </CardTitle>
            <CardDescription>
              Une fois votre compte créé, cette copropriété sera automatiquement initialisée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Immeuble</p>
                <p className="text-foreground font-medium">{buildingDisplay}</p>
                {invitation.building.code_postal && invitation.building.ville && (
                  <p className="text-muted-foreground inline-flex items-center gap-1 text-xs mt-1">
                    <MapPin className="w-3 h-3" />
                    {invitation.building.code_postal} {invitation.building.ville}
                  </p>
                )}
              </div>
              {invitation.building.total_lots_in_building && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                    Nombre de lots
                  </p>
                  <p className="text-foreground font-medium">
                    {invitation.building.total_lots_in_building} lot(s)
                  </p>
                </div>
              )}
              {invitation.suggested_copro_name && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                    Nom suggéré
                  </p>
                  <p className="text-foreground">{invitation.suggested_copro_name}</p>
                </div>
              )}
            </div>

            {invitation.message && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                  Message du copropriétaire
                </p>
                <p className="text-foreground italic">« {invitation.message} »</p>
              </div>
            )}

            {(invitation.suggested_syndic_name || invitation.suggested_syndic_email) && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Coordonnées pré-remplies
                </p>
                {invitation.suggested_syndic_name && (
                  <p className="text-foreground inline-flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {invitation.suggested_syndic_name}
                  </p>
                )}
                {invitation.suggested_syndic_email && (
                  <p className="text-foreground inline-flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {invitation.suggested_syndic_email}
                  </p>
                )}
                {invitation.suggested_syndic_phone && (
                  <p className="text-foreground inline-flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {invitation.suggested_syndic_phone}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyan-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Avec Talok, vous pourrez :</p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                  <li>• Convoquer et tenir vos AG (vote en ligne par tantièmes, PV PDF auto)</li>
                  <li>• Émettre les appels de fonds, exporter le SEPA, suivre les impayés</li>
                  <li>• Tenir une comptabilité copropriété (décret 2005-240) et exporter le FEC</li>
                  <li>• Gérer mandats, conseils syndicaux, contrats fournisseurs</li>
                  <li>• Mettre à disposition l'extranet aux copropriétaires</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          {authed ? (
            <Button
              size="lg"
              onClick={handleAcceptAfterAuth}
              disabled={claiming}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
            >
              {claiming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Initialiser cette copropriété sur mon compte
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <>
              <Link href={signupUrl}>
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                >
                  Créer mon compte syndic
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href={`/auth/signin?redirect=/auth/syndic-invite/${token}`}>
                <Button size="lg" variant="outline" className="w-full">
                  J'ai déjà un compte
                </Button>
              </Link>
            </>
          )}
          <p className="text-center text-xs text-muted-foreground mt-2">
            Lien valide jusqu'au{" "}
            {new Date(invitation.expires_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
        </div>
      </div>
    </div>
  );
}
