// =====================================================
// Onboarding Syndic - Étape finale: Confirmation
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2, Building2, Home, Users, Calculator,
  Sparkles, ArrowRight, Rocket, Mail, RefreshCw
} from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingData {
  site: {
    id: string;
    name: string;
    type: string;
    address: string;
    city: string;
    postal_code: string;
  } | null;
  buildings: Array<{
    id: string;
    name: string;
    type: string;
    totalUnits: number;
  }>;
  units: Array<{
    id: string;
    lot_number: string;
    type: string;
  }>;
  tantiemes: Array<{
    unit_id: string;
    tantieme_general: number;
  }>;
  owners: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    send_invite: boolean;
    unit_ids: string[];
  }>;
}

export default function OnboardingCompletePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Charger toutes les données
    const site = localStorage.getItem('syndic_onboarding_site');
    const buildings = localStorage.getItem('syndic_onboarding_buildings');
    const units = localStorage.getItem('syndic_onboarding_units');
    const tantiemes = localStorage.getItem('syndic_onboarding_tantiemes');
    const owners = localStorage.getItem('syndic_onboarding_owners');

    setData({
      site: site ? JSON.parse(site) : null,
      buildings: buildings ? JSON.parse(buildings) : [],
      units: units ? JSON.parse(units) : [],
      tantiemes: tantiemes ? JSON.parse(tantiemes) : [],
      owners: owners ? JSON.parse(owners) : []
    });
  }, []);

  const handleFinalize = async () => {
    if (!data?.site) {
      toast({
        title: "Données manquantes",
        description: "Veuillez compléter toutes les étapes.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    setProgress(0);

    try {
      const siteId = (data.site as any)?.id;

      if (!siteId) {
        throw new Error("ID du site manquant. Veuillez reprendre depuis l'étape de création du site.");
      }

      // Étape 1: Créer les lots en batch
      setProgress(30);
      if (data.units.length > 0) {
        const unitsPayload = data.units.map((unit) => ({
          site_id: siteId,
          lot_number: unit.lot_number,
          unit_type: unit.type || "appartement",
          tantieme_general: data.tantiemes.find((t) => t.unit_id === unit.id)?.tantieme_general ?? 0,
        }));

        const unitsRes = await fetch("/api/copro/units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ units: unitsPayload }),
        });

        if (!unitsRes.ok) {
          const err = await unitsRes.json().catch(() => ({}));
          throw new Error(err.error || "Erreur création des lots");
        }
      }

      // Étape 2: Envoyer les invitations aux copropriétaires
      setProgress(70);
      const invitableOwners = data.owners.filter((o) => o.send_invite && o.email);
      if (invitableOwners.length > 0) {
        const invitesRes = await fetch("/api/copro/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: siteId,
            invites: invitableOwners.map((owner) => ({
              email: owner.email,
              first_name: owner.first_name,
              last_name: owner.last_name,
              target_role: "coproprietaire_occupant",
            })),
            send_emails: true,
          }),
        });

        if (!invitesRes.ok) {
          console.error("Erreur envoi invitations (non bloquant)");
        }
      }

      setProgress(100);

      // Nettoyer le localStorage
      localStorage.removeItem('syndic_profile');
      localStorage.removeItem('syndic_onboarding_site');
      localStorage.removeItem('syndic_onboarding_buildings');
      localStorage.removeItem('syndic_onboarding_units');
      localStorage.removeItem('syndic_onboarding_tantiemes');
      localStorage.removeItem('syndic_onboarding_owners');

      // Confetti !
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setCompleted(true);

      toast({
        title: "Configuration terminée !",
        description: "Votre copropriété est prête à être gérée."
      });

    } catch (error) {
      console.error('Erreur finalisation:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la finalisation.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalTantiemes = data.tantiemes.reduce((sum, t) => sum + t.tantieme_general, 0);
  const ownersToInvite = data.owners.filter(o => o.send_invite).length;

  // Écran de succès
  if (completed) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
            <CardContent className="p-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 mx-auto mb-8 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <Rocket className="w-12 h-12 text-emerald-400" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white mb-4"
              >
                Félicitations ! 🎉
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-300 mb-8 text-lg"
              >
                Votre copropriété <span className="font-semibold text-emerald-400">{data.site?.name}</span> 
                {" "}est maintenant configurée et prête à être gérée.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-4 mb-8"
              >
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-3xl font-bold text-white">{data.units.length}</p>
                  <p className="text-slate-400">Lots créés</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-3xl font-bold text-violet-400">{ownersToInvite}</p>
                  <p className="text-slate-400">Invitations envoyées</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  onClick={() => router.push('/syndic/dashboard')}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600"
                  size="lg"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Accéder au tableau de bord
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/syndic/sites')}
                  className="w-full border-white/10 text-white"
                >
                  Gérer les copropriétés
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white mb-2">Récapitulatif</h2>
        <p className="text-slate-400">
          Vérifiez les informations avant de finaliser la configuration.
        </p>
      </motion.div>

      {/* Résumé Site */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-violet-500/20">
                <Building2 className="w-6 h-6 text-violet-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">{data.site?.name || 'Non défini'}</h3>
                <p className="text-slate-400 text-sm">
                  {data.site?.address}, {data.site?.postal_code} {data.site?.city}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-cyan-500/20 text-cyan-400">
                    {data.buildings.length} bâtiment(s)
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400">
                    {data.site?.type || 'copropriété'}
                  </Badge>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Résumé Lots */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-cyan-500/20">
                <Home className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {data.units.length} lots configurés
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.buildings.map(building => (
                    <Badge key={building.id} className="bg-slate-500/20 text-slate-300">
                      {building.name}: {building.totalUnits} lots
                    </Badge>
                  ))}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Résumé Tantièmes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Calculator className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Tantièmes généraux
                </h3>
                <p className="text-slate-400 text-sm">
                  Total: <span className="text-amber-400 font-semibold">{totalTantiemes.toLocaleString('fr-FR')}</span> tantièmes
                </p>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${totalTantiemes > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Résumé Copropriétaires */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {data.owners.length} copropriétaire(s)
                </h3>
                {ownersToInvite > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Mail className="w-4 h-4 text-violet-400" />
                    <span className="text-slate-400 text-sm">
                      {ownersToInvite} invitation(s) seront envoyées
                    </span>
                  </div>
                )}
              </div>
              <CheckCircle2 className={`w-5 h-5 ${data.owners.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress pendant la sauvegarde */}
      {saving && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="border-violet-500/30 bg-violet-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
                <span className="text-white">Création de votre copropriété...</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-700" />
              <p className="text-sm text-slate-400 mt-2 text-center">{progress}%</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Actions */}
      {!saving && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-between pt-4"
        >
          <Button 
            variant="outline" 
            onClick={() => router.push('/syndic/onboarding/owners')}
            className="border-white/10 text-white"
          >
            Retour
          </Button>
          <Button 
            onClick={handleFinalize}
            className="bg-gradient-to-r from-violet-500 to-purple-600 px-8"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Finaliser et lancer
          </Button>
        </motion.div>
      )}
    </div>
  );
}

