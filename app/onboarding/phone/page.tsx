"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Phone, ArrowRight, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPhonePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setStep("verify");
      toast({
        title: "Code envoyé",
        description: "Un code de vérification a été envoyé à votre numéro.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer le code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      });
      if (error) throw error;

      // Mettre à jour le profil
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            telephone: phone,
            phone_verified: true,
            phone_verified_at: new Date().toISOString(),
            identity_status: "phone_verified",
            onboarding_step: "phone_done",
          })
          .eq("user_id", user.id);
      }

      toast({
        title: "Numéro vérifié",
        description: "Votre numéro de téléphone a été vérifié avec succès.",
      });
      router.push(from);
    } catch (error: unknown) {
      toast({
        title: "Code invalide",
        description:
          error instanceof Error
            ? error.message
            : "Le code saisi est incorrect.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Vérifiez votre téléphone</CardTitle>
        <CardDescription className="text-base">
          {step === "input"
            ? "Pour sécuriser votre compte, nous avons besoin de vérifier votre numéro de téléphone."
            : "Entrez le code reçu par SMS."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "input" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSendCode}
              disabled={loading || !phone.trim()}
              className="w-full"
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Envoyer le code
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="code">Code de vérification</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={loading || !code.trim()}
              className="w-full"
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Vérifier
            </Button>
            <button
              onClick={() => {
                setStep("input");
                setCode("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground text-center block w-full"
            >
              Changer de numéro
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
