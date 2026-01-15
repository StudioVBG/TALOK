"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { OrganizationBranding, DEFAULT_BRANDING } from "@/lib/white-label/types";

interface BrandedLoginProps {
  branding: Partial<OrganizationBranding>;
  onSubmit?: (email: string, password: string) => Promise<void>;
  isPreview?: boolean;
  className?: string;
}

export function BrandedLogin({
  branding,
  onSubmit,
  isPreview = false,
  className,
}: BrandedLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyName = branding.company_name || DEFAULT_BRANDING.company_name || "Talok";
  const tagline = branding.tagline || "Gestion locative simplifiée";
  const logoUrl = branding.logo_url;
  const primaryColor = branding.primary_color || DEFAULT_BRANDING.primary_color;
  const backgroundUrl = branding.login_background_url;
  const backgroundColor = branding.login_background_color || "#f8fafc";
  const removePoweredBy = branding.remove_powered_by || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview) return;
    if (!onSubmit) return;

    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center p-4",
        className
      )}
      style={{
        backgroundColor: backgroundUrl ? undefined : backgroundColor,
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay si image de fond */}
      {backgroundUrl && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-12 mx-auto mb-4"
              />
            ) : (
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                🏠 {companyName}
              </h1>
            )}
            <p className="text-slate-500">{tagline}</p>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-slate-900 text-center mb-6">
            Connexion à votre espace
          </h2>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <a
                  href="#"
                  className="text-sm hover:underline"
                  style={{ color: primaryColor }}
                  onClick={(e) => isPreview && e.preventDefault()}
                >
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-sm text-slate-400">ou</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* SSO Buttons (placeholder) */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={isPreview}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuer avec Google
            </Button>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Pas encore de compte ?{" "}
            <a
              href="#"
              className="font-medium hover:underline"
              style={{ color: primaryColor }}
              onClick={(e) => isPreview && e.preventDefault()}
            >
              Créer un compte
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} {companyName}
          </p>
          {!removePoweredBy && (
            <p className="mt-1 text-xs text-slate-400">
              Propulsé par{" "}
              <a
                href="https://talok.fr"
                className="hover:text-slate-500 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Talok
              </a>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Prévisualisation de la page de login dans un cadre
 */
export function LoginPreview({
  branding,
  className,
}: {
  branding: Partial<OrganizationBranding>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border border-slate-200 shadow-lg",
        className
      )}
      style={{ height: 500 }}
    >
      <div className="transform scale-[0.6] origin-top-left w-[166.67%] h-[166.67%]">
        <BrandedLogin branding={branding} isPreview />
      </div>
    </div>
  );
}

export default BrandedLogin;
