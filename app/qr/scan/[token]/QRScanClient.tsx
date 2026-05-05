"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Smartphone,
  Key,
  FileText,
  LogIn,
} from "lucide-react";
import { motion } from "framer-motion";

type QRSessionKind =
  | "mobile_signin"
  | "key_handover"
  | "document_signature"
  | "lease_signature"
  | "edl_signature"
  | "2fa_setup_companion";

interface SessionData {
  sessionId: string;
  kind: QRSessionKind;
  status: "scanned" | "pending" | "confirmed" | "expired" | "consumed";
  payload: Record<string, any>;
  redirectUrl: string | null;
  expiresAt: string;
}

const KIND_LABELS: Record<QRSessionKind, { title: string; icon: any; cta: string; description: string }> = {
  mobile_signin: {
    title: "Connexion mobile",
    icon: LogIn,
    cta: "Confirmer la connexion",
    description: "Confirmez la connexion sur votre ordinateur depuis ce mobile.",
  },
  key_handover: {
    title: "Remise des clés",
    icon: Key,
    cta: "Confirmer la remise",
    description: "Confirmez la remise des clés.",
  },
  document_signature: {
    title: "Signature de document",
    icon: FileText,
    cta: "Signer le document",
    description: "Confirmez la signature du document.",
  },
  lease_signature: {
    title: "Signature du bail",
    icon: FileText,
    cta: "Signer le bail",
    description: "Confirmez la signature du bail.",
  },
  edl_signature: {
    title: "Signature de l'état des lieux",
    icon: FileText,
    cta: "Signer l'EDL",
    description: "Confirmez la signature de l'état des lieux.",
  },
  "2fa_setup_companion": {
    title: "Configuration 2FA",
    icon: Smartphone,
    cta: "Confirmer",
    description: "Confirmez l'opération depuis votre mobile.",
  },
};

export default function QRScanClient({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const loadSession = useCallback(async () => {
    setLoadingSession(true);
    setError(null);
    try {
      const res = await fetch(`/api/qr/sessions/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Session inaccessible");
      }
      setSession(data);
      if (data.status === "confirmed") {
        setConfirmed(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingSession(false);
    }
  }, [token]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const confirm = useCallback(async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/qr/sessions/${encodeURIComponent(token)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la confirmation");

      setConfirmed(true);
      toast({
        title: "Confirmé",
        description: "L'opération a été validée.",
      });

      // Redirige le mobile aussi
      setTimeout(() => {
        if (data.redirectUrl) {
          router.push(data.redirectUrl);
        } else {
          router.push("/");
        }
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setConfirming(false);
    }
  }, [token, toast, router]);

  if (loadingSession) {
    return (
      <div className="container mx-auto px-4 max-w-lg py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session && error) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 max-w-lg space-y-6">
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lien invalide</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/")} variant="outline" className="w-full h-12 rounded-xl">
            Retour à l'accueil
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (!session) return null;

  const meta = KIND_LABELS[session.kind] ?? KIND_LABELS.mobile_signin;
  const Icon = meta.icon;

  if (confirmed) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 max-w-lg space-y-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">Confirmé !</h1>
            <p className="text-slate-500 text-lg">
              L'opération a été validée. Vous pouvez retourner à votre ordinateur.
            </p>
          </motion.div>

          <GlassCard className="p-6 bg-emerald-50 border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 text-sm">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span>Action authentifiée et horodatée</span>
            </div>
          </GlassCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="container mx-auto px-4 max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-2">
            <Icon className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">{meta.title}</h1>
          <p className="text-slate-500 text-lg">{meta.description}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {Object.keys(session.payload || {}).length > 0 && (
          <GlassCard className="p-6 border-slate-200 bg-white shadow-xl">
            <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">
              Détails
            </h3>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-50 p-3 rounded-lg border border-slate-100">
              {JSON.stringify(session.payload, null, 2)}
            </pre>
          </GlassCard>
        )}

        <Button
          onClick={confirm}
          disabled={confirming}
          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-100 group"
        >
          {confirming ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Confirmation...
            </>
          ) : (
            <>
              {meta.cta}
              <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Authentification chiffrée et horodatée
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
