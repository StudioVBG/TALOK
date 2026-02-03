// =====================================================
// Page: Acceptation d'une invitation COPRO
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Building2, CheckCircle2, AlertCircle, Clock,
  User, Mail, MapPin, Key, ArrowRight, LogIn
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS, OWNERSHIP_TYPE_LABELS } from "@/lib/types/copro";
import type { InviteValidationResult } from "@/lib/types/copro";

export default function CoproInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get('token');

  const [inviteData, setInviteData] = useState<InviteValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Token d\'invitation manquant');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/copro/invites/${token}`);
        const data = await response.json();
        setInviteData(data);
        
        if (!data.is_valid) {
          setError(data.error_message || 'Invitation invalide');
        }
      } catch (err) {
        setError('Erreur lors de la validation de l\'invitation');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  const handleAccept = async () => {
    if (!user || !token) return;

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch(`/api/copro/invites/${token}`, {
        method: 'POST',
      });
      
      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        // Rediriger après 2 secondes
        setTimeout(() => {
          router.push(result.redirect_url || '/copro/dashboard');
        }, 2000);
      } else {
        setError(result.error_message || 'Erreur lors de l\'acceptation');
      }
    } catch (err) {
      setError('Erreur lors de l\'acceptation de l\'invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return <InviteSkeleton />;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Bienvenue dans la copropriété !
          </h1>
          <p className="text-slate-400 mb-4">
            Vous allez être redirigé vers votre espace...
          </p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
        </motion.div>
      </div>
    );
  }

  if (error && !inviteData?.is_valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invitation invalide
          </h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link href="/">
            <Button variant="outline" className="border-white/10 text-white">
              Retour à l'accueil
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4"
            >
              <Building2 className="w-8 h-8 text-white" />
            </motion.div>
            <CardTitle className="text-2xl text-white">
              Invitation à rejoindre une copropriété
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Détails de l'invitation */}
            <div className="space-y-4 p-4 rounded-lg bg-slate-800/50">
              {/* Copropriété */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Copropriété</p>
                  <p className="text-white font-semibold">{inviteData?.site_name}</p>
                </div>
              </div>

              {/* Lot */}
              {inviteData?.lot_number && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20">
                    <Key className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Lot attribué</p>
                    <p className="text-white font-semibold">Lot n°{inviteData.lot_number}</p>
                  </div>
                </div>
              )}

              {/* Rôle */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Vous serez</p>
                  <Badge className="bg-emerald-500/20 text-emerald-400">
                    {inviteData?.target_role && ROLE_LABELS[inviteData.target_role as keyof typeof ROLE_LABELS]}
                  </Badge>
                </div>
              </div>

              {/* Type de propriété */}
              {inviteData?.ownership_type && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <MapPin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Type de propriété</p>
                    <p className="text-white">
                      {OWNERSHIP_TYPE_LABELS[inviteData.ownership_type as keyof typeof OWNERSHIP_TYPE_LABELS]}
                      {inviteData.ownership_share && inviteData.ownership_share < 1 && 
                        ` (${(inviteData.ownership_share * 100).toFixed(0)}%)`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Email attendu */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-500/20">
                  <Mail className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Destinataire</p>
                  <p className="text-white">{inviteData?.email}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {user ? (
              // Utilisateur connecté
              user.email?.toLowerCase() === inviteData?.email?.toLowerCase() ? (
                <div className="space-y-3">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                  <Button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                  >
                    {accepting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Acceptation en cours...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Accepter l'invitation
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-slate-400 text-center">
                    Connecté en tant que {user.email}
                  </p>
                </div>
              ) : (
                // Email ne correspond pas
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Cette invitation est destinée à <strong>{inviteData?.email}</strong>.
                    Vous êtes connecté avec <strong>{user.email}</strong>.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white"
                    onClick={() => {/* TODO: Déconnexion */}}
                  >
                    Se connecter avec un autre compte
                  </Button>
                </div>
              )
            ) : (
              // Non connecté
              <div className="space-y-3">
                <p className="text-slate-400 text-sm text-center">
                  Pour accepter cette invitation, connectez-vous ou créez un compte 
                  avec l'adresse <strong className="text-white">{inviteData?.email}</strong>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    href={`/auth/signin?redirect=/invite/copro?token=${token}&email=${inviteData?.email}`}
                  >
                    <Button variant="outline" className="w-full border-white/10 text-white">
                      <LogIn className="w-4 h-4 mr-2" />
                      Se connecter
                    </Button>
                  </Link>
                  <Link 
                    href={`/auth/signup?redirect=/invite/copro?token=${token}&email=${inviteData?.email}&role=${inviteData?.target_role}`}
                  >
                    <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600">
                      Créer un compte
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10 bg-white/5">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4 bg-white/10" />
            <Skeleton className="h-8 w-64 mx-auto bg-white/10" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 bg-white/10" />
            ))}
          </div>
          <Skeleton className="h-10 bg-white/10" />
        </CardContent>
      </Card>
    </div>
  );
}

