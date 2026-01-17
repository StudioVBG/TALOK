"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { authService } from "../services/auth.service";
import type { SignInData } from "../services/auth.service";

// Icône SVG pour Google OAuth
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// Icône SVG pour Apple OAuth
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

export function SignInForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [formData, setFormData] = useState<SignInData>({
    email: "",
    password: "",
  });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      // La redirection est gérée par Supabase
    } catch (error: unknown) {
      console.error("[SignIn] Erreur OAuth Google:", error);
      const errorMessage = error instanceof Error ? error.message : "Impossible de se connecter avec Google";
      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await authService.signInWithApple();
      // La redirection est gérée par Supabase
    } catch (error: unknown) {
      console.error("[SignIn] Erreur OAuth Apple:", error);
      const errorMessage = error instanceof Error ? error.message : "Impossible de se connecter avec Apple";
      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
      });
      setAppleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("[SignIn] Tentative de connexion pour:", formData.email);
      
      const result = await authService.signIn(formData);
      
      if (!result || !result.user) {
        throw new Error("Aucune donnée utilisateur retournée");
      }

      console.log("[SignIn] Connexion réussie, utilisateur:", result.user.id);
      
      // Vérifier si l'email est confirmé
      if (result.user && !result.user.email_confirmed_at) {
        console.log("[SignIn] Email non confirmé");
        toast({
          title: "Email non confirmé",
          description: "Veuillez confirmer votre email avant de vous connecter.",
        });
        router.push("/auth/verify-email");
        return;
      }

      // Attendre un peu pour que la session soit bien établie
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Récupérer le profil pour rediriger selon le rôle
      console.log("[SignIn] Récupération du profil...");
      const profile = await authService.getProfile();
      const profileData = profile as any;
      
      console.log("[SignIn] Profil récupéré:", profileData?.role);
      
      if (!profileData) {
        console.warn("[SignIn] Aucun profil trouvé, redirection vers /dashboard");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      
      // Rediriger selon le rôle - Routes existantes fonctionnelles
      if (profileData?.role === "admin") {
        console.log("[SignIn] Redirection vers /admin/dashboard");
        router.push("/admin/dashboard");
      } else if (profileData?.role === "owner") {
        console.log("[SignIn] Redirection vers /owner/dashboard");
        router.push("/owner/dashboard");
      } else if (profileData?.role === "tenant") {
        console.log("[SignIn] Redirection vers /tenant/dashboard");
        router.push("/tenant/dashboard");
      } else if (profileData?.role === "provider") {
        console.log("[SignIn] Redirection vers /vendor/dashboard");
        router.push("/vendor/dashboard");
      } else {
        console.log("[SignIn] Redirection vers /dashboard");
        router.push("/dashboard");
      }
      
      router.refresh();
    } catch (error: unknown) {
      console.error("[SignIn] Erreur de connexion:", error);

      // Extraire le message et le status de manière type-safe
      const rawMessage = error instanceof Error ? error.message : "";
      const errorMessage = rawMessage.toLowerCase();
      const errorStatus = (error as { status?: number })?.status;

      // Vérifier si l'erreur est liée à l'email non confirmé
      if (
        errorMessage.includes("email not confirmed") ||
        errorMessage.includes("email_not_confirmed") ||
        errorMessage.includes("confirmer votre email") ||
        (errorStatus === 400 && errorMessage.includes("email"))
      ) {
        toast({
          title: "Email non confirmé",
          description: "Veuillez confirmer votre email avant de vous connecter. Vous allez être redirigé.",
        });
        // Stocker l'email pour la page de vérification (via sessionStorage)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pendingEmailVerification", formData.email);
        }
        router.push("/auth/verify-email");
      } else if (errorMessage.includes("incorrect") || errorMessage.includes("invalid")) {
        toast({
          title: "Erreur de connexion",
          description: "Email ou mot de passe incorrect. Vérifiez vos identifiants.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur de connexion",
          description: rawMessage || "Une erreur est survenue lors de la connexion. Veuillez réessayer.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Connectez-vous à votre compte</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Boutons OAuth */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading || appleLoading}
            className="w-full"
          >
            {googleLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <GoogleIcon />
            )}
            <span className="ml-2">Continuer avec Google</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleAppleSignIn}
            disabled={loading || googleLoading || appleLoading}
            className="w-full bg-black text-white hover:bg-gray-800 hover:text-white"
          >
            {appleLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
            ) : (
              <AppleIcon />
            )}
            <span className="ml-2">Continuer avec Apple</span>
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        {/* Formulaire email/password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading || googleLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <PasswordInput
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={loading || googleLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || googleLoading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 text-sm text-muted-foreground">
        <p>
          Mot de passe oublié ?{" "}
          <Link href="/auth/forgot-password" className="text-primary underline-offset-2 hover:underline">
            Réinitialiser
          </Link>
        </p>
        <p>
          Besoin d’aide ?{" "}
          <a
            href="mailto:support@talok.fr"
            className="text-primary underline-offset-2 hover:underline"
          >
            Contacter l’équipe
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}

