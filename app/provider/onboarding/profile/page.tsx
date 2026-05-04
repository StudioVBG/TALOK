"use client";

/**
 * Étape onboarding prestataire : "Identité légale".
 *
 * Flux SOTA 2026 :
 *   1. L'artisan saisit son SIRET dans <SiretInput />
 *   2. L'API publique Recherche d'entreprises auto-remplit raison sociale,
 *      forme juridique, RCS, NAF, dirigeant, N° TVA, adresse siège, RGE…
 *   3. Les champs auto-remplis sont affichés en lecture seule avec un
 *      badge "✓ Vérifié INSEE" — l'artisan ne ressaisit rien
 *   4. Il complète manuellement : décennale, assurance RC pro, qualifications
 *   5. À la soumission, tout est persisté dans la table `providers`
 *      (lien `profile_id` ⇒ row canonique). Les devis, factures et fiches
 *      publiques liront ce profil au lieu de redemander à l'artisan.
 */

import { ArrowRight, Briefcase, CheckCircle2, Hash, MapPin, ShieldCheck, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiretInput } from "@/components/siret/SiretInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import type { ResolvedLegalIdentity } from "@/lib/siret/types";
import { TRADE_CATEGORY_LABELS, type TradeCategory } from "@/lib/types/providers";

interface ContactState {
  contact_name: string;
  email: string;
  phone: string;
}

interface InsuranceState {
  decennale_number: string;
  decennale_expiry: string;
  insurance_number: string;
  insurance_expiry: string;
}

const TRADE_CATEGORIES = Object.entries(TRADE_CATEGORY_LABELS) as Array<[TradeCategory, string]>;

export default function ProviderProfileOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [siret, setSiret] = useState("");
  const [resolved, setResolved] = useState<ResolvedLegalIdentity | null>(null);
  const [contact, setContact] = useState<ContactState>({
    contact_name: "",
    email: "",
    phone: "",
  });
  const [insurance, setInsurance] = useState<InsuranceState>({
    decennale_number: "",
    decennale_expiry: "",
    insurance_number: "",
    insurance_expiry: "",
  });
  const [categories, setCategories] = useState<TradeCategory[]>([]);

  // Pré-remplir le contact depuis le profil utilisateur si disponible
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("prenom, nom, email, telephone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !profile) return;
      setContact((prev) => ({
        contact_name: prev.contact_name || [profile.prenom, profile.nom].filter(Boolean).join(" "),
        email: prev.email || profile.email || user.email || "",
        phone: prev.phone || profile.telephone || "",
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restaurer le brouillon (ex: SIRET déjà résolu, catégories cochées)
  useEffect(() => {
    onboardingService.getDraft().then((draft) => {
      if (!draft?.data || draft.role !== "provider") return;
      const d = draft.data as Record<string, unknown>;
      if (typeof d.siret === "string") setSiret(d.siret);
      if (Array.isArray(d.categories)) {
        setCategories(d.categories as TradeCategory[]);
      }
      if (d.resolved && typeof d.resolved === "object") {
        setResolved(d.resolved as ResolvedLegalIdentity);
      }
    });
  }, []);

  const toggleCategory = (cat: TradeCategory) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const formIsValid = useMemo(() => {
    if (!resolved) return false;
    if (categories.length === 0) return false;
    if (!contact.contact_name || !contact.email || !contact.phone) return false;
    return true;
  }, [resolved, categories, contact]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolved) {
      toast({
        title: "Identité non vérifiée",
        description: "Saisissez votre SIRET et cliquez sur « Vérifier ».",
        variant: "destructive",
      });
      return;
    }
    if (categories.length === 0) {
      toast({
        title: "Spécialités requises",
        description: "Sélectionnez au moins une spécialité.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/provider/legal-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siret: resolved.siret,
          raison_sociale: resolved.raison_sociale,
          forme_juridique: resolved.forme_juridique,
          nature_juridique_code: resolved.nature_juridique_code,
          capital_social: resolved.capital_social,
          date_creation: resolved.date_creation,
          rcs_numero: resolved.rcs_numero,
          rcs_ville: resolved.rcs_ville,
          tva_intra: resolved.tva_intra,
          naf_code: resolved.naf_code,
          naf_label: resolved.naf_label,
          dirigeant_nom: resolved.dirigeant_nom,
          dirigeant_prenom: resolved.dirigeant_prenom,
          dirigeant_qualite: resolved.dirigeant_qualite,
          est_rge: resolved.est_rge,
          etat_administratif: resolved.etat_administratif,
          api_source: "recherche-entreprises.api.gouv.fr",
          address: resolved.adresse,
          postal_code: resolved.code_postal,
          city: resolved.ville,
          contact_name: contact.contact_name,
          email: contact.email,
          phone: contact.phone,
          trade_categories: categories,
          decennale_number: insurance.decennale_number || null,
          decennale_expiry: insurance.decennale_expiry || null,
          insurance_number: insurance.insurance_number || null,
          insurance_expiry: insurance.insurance_expiry || null,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Impossible d'enregistrer votre identité légale");
      }

      await onboardingService.saveDraft(
        "provider_profile",
        { siret: resolved.siret, categories, resolved },
        "provider",
      );
      await onboardingService.markStepCompleted("provider_profile", "provider");

      toast({
        title: "Identité vérifiée",
        description: "Votre profil professionnel a été enregistré et certifié.",
      });
      router.push("/provider/onboarding/services");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center p-4 pt-8 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            <CardTitle>Identité légale</CardTitle>
          </div>
          <CardDescription>
            Saisissez votre SIRET — nous récupérons automatiquement vos informations légales auprès de l'INSEE. Vous ne
            ressaisirez rien ailleurs sur Talok.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* === SIRET INPUT === */}
            <SiretInput
              value={siret}
              onChange={setSiret}
              onResolve={(data) => setResolved(data)}
              onError={() => setResolved(null)}
              disabled={loading}
            />

            {/* === FICHE INSEE === */}
            {resolved && (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Identité vérifiée auprès de l'INSEE</h3>
                  </div>
                  {resolved.est_rge && (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
                      <Sparkles className="mr-1 h-3 w-3" />
                      RGE
                    </Badge>
                  )}
                </div>

                <ResolvedRow label="Raison sociale" value={resolved.raison_sociale} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResolvedRow label="Forme juridique" value={resolved.forme_juridique} />
                  <ResolvedRow label="N° TVA intra" value={resolved.tva_intra} />
                  <ResolvedRow label="SIREN" value={resolved.siren} />
                  <ResolvedRow
                    label="Code NAF"
                    value={
                      resolved.naf_code
                        ? `${resolved.naf_code}${resolved.naf_label ? ` — ${resolved.naf_label}` : ""}`
                        : null
                    }
                  />
                  <ResolvedRow
                    label="Capital social"
                    value={
                      resolved.capital_social != null ? `${resolved.capital_social.toLocaleString("fr-FR")} €` : null
                    }
                  />
                  <ResolvedRow label="Date d'immatriculation" value={resolved.date_creation} />
                </div>

                {(resolved.adresse || resolved.code_postal || resolved.ville) && (
                  <div className="flex items-start gap-2 pt-2 border-t border-green-200">
                    <MapPin className="h-4 w-4 mt-0.5 text-green-700 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">Adresse du siège</div>
                      <div className="text-green-800">
                        {[resolved.adresse, [resolved.code_postal, resolved.ville].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                )}

                {(resolved.dirigeant_nom || resolved.dirigeant_prenom) && (
                  <div className="flex items-start gap-2 pt-2 border-t border-green-200">
                    <User className="h-4 w-4 mt-0.5 text-green-700 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">Représentant légal</div>
                      <div className="text-green-800">
                        {[resolved.dirigeant_prenom, resolved.dirigeant_nom].filter(Boolean).join(" ")}
                        {resolved.dirigeant_qualite ? ` — ${resolved.dirigeant_qualite}` : ""}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === CONTACT === */}
            {resolved && (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold">Contact professionnel</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">
                      Nom du contact <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contact_name"
                      value={contact.contact_name}
                      onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email pro <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="phone">
                      Téléphone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {/* === SPECIALITES === */}
            {resolved && (
              <fieldset className="space-y-3">
                <legend className="text-base font-semibold">
                  Spécialités <span className="text-destructive">*</span>
                </legend>
                <p className="text-xs text-muted-foreground -mt-1">
                  Sélectionnez les corps de métier pour lesquels vous souhaitez recevoir des demandes.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {TRADE_CATEGORIES.map(([value, label]) => {
                    const checked = categories.includes(value);
                    return (
                      <label
                        key={value}
                        className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer text-sm transition-colors ${
                          checked ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(value)}
                          disabled={loading}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{label}</span>
                        {checked && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* === ASSURANCES === */}
            {resolved && (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Assurances professionnelles
                </legend>
                <p className="text-xs text-muted-foreground -mt-2">
                  Optionnel à cette étape, mais obligatoire avant d'émettre des devis dans le bâtiment. Vous pourrez
                  compléter plus tard.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="decennale_number">N° police décennale</Label>
                    <Input
                      id="decennale_number"
                      value={insurance.decennale_number}
                      onChange={(e) =>
                        setInsurance({
                          ...insurance,
                          decennale_number: e.target.value,
                        })
                      }
                      disabled={loading}
                      placeholder="Ex: 123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decennale_expiry">Échéance décennale</Label>
                    <Input
                      id="decennale_expiry"
                      type="date"
                      value={insurance.decennale_expiry}
                      onChange={(e) =>
                        setInsurance({
                          ...insurance,
                          decennale_expiry: e.target.value,
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurance_number">N° police RC Pro</Label>
                    <Input
                      id="insurance_number"
                      value={insurance.insurance_number}
                      onChange={(e) =>
                        setInsurance({
                          ...insurance,
                          insurance_number: e.target.value,
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurance_expiry">Échéance RC Pro</Label>
                    <Input
                      id="insurance_expiry"
                      type="date"
                      value={insurance.insurance_expiry}
                      onChange={(e) =>
                        setInsurance({
                          ...insurance,
                          insurance_expiry: e.target.value,
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            <Button type="submit" className="w-full" disabled={loading || !formIsValid}>
              {loading ? (
                "Enregistrement..."
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ResolvedRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm">
      <div className="text-xs font-medium text-green-900">{label}</div>
      <div className="text-green-800">{value ?? "—"}</div>
    </div>
  );
}
