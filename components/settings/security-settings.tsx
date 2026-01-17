"use client";

/**
 * Composant de paramètres de sécurité SOTA 2026
 * - Gestion des Passkeys (WebAuthn)
 * - Configuration 2FA (TOTP)
 * - Recovery codes
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  isWebAuthnSupported,
  registerPasskey,
  getPasskeyDisplayInfo,
  type PasskeyCredential,
} from "@/lib/auth/passkeys";
import {
  Shield,
  Fingerprint,
  Smartphone,
  Key,
  Trash2,
  Plus,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface SecurityStatus {
  twoFactorEnabled: boolean;
  twoFactorActivatedAt: string | null;
  remainingRecoveryCodes: number;
  passkeys: PasskeyCredential[];
  passkeyCount: number;
}

export function SecuritySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  // États pour 2FA setup
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [totpQRCode, setTotpQRCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [activating2FA, setActivating2FA] = useState(false);

  // États pour passkey
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    fetchSecurityStatus();
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      const response = await fetch("/api/auth/2fa/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Erreur récupération statut:", error);
    } finally {
      setLoading(false);
    }
  };

  // ============ 2FA Functions ============

  const startTOTPSetup = async () => {
    try {
      const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setTotpQRCode(data.qrCodeUrl);
      setTotpSecret(data.secret);
      setRecoveryCodes(data.recoveryCodes);
      setShowTOTPSetup(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const verify2FACode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Code invalide",
        description: "Le code doit contenir 6 chiffres.",
        variant: "destructive",
      });
      return;
    }

    setActivating2FA(true);
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: verificationCode,
          activateAfterVerify: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: "2FA activé",
        description: "L'authentification à deux facteurs est maintenant active.",
      });

      setShowTOTPSetup(false);
      setVerificationCode("");
      fetchSecurityStatus();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActivating2FA(false);
    }
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast({
      title: "Copié",
      description: "Les codes de récupération ont été copiés.",
    });
  };

  // ============ Passkey Functions ============

  const addPasskey = async () => {
    setAddingPasskey(true);
    try {
      // 1. Obtenir les options d'enregistrement
      const optionsResponse = await fetch("/api/auth/passkeys/register/options", {
        method: "POST",
      });
      const options = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(options.error);
      }

      // 2. Créer la passkey via WebAuthn
      const credential = await registerPasskey(options);

      // 3. Vérifier et enregistrer
      const verifyResponse = await fetch("/api/auth/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          friendlyName: passkeyName || "Ma passkey",
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error);
      }

      toast({
        title: "Passkey ajoutée",
        description: "Votre passkey a été enregistrée avec succès.",
      });

      setPasskeyName("");
      fetchSecurityStatus();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAddingPasskey(false);
    }
  };

  const deletePasskey = async (credentialId: string) => {
    if (!confirm("Supprimer cette passkey ?")) return;

    try {
      const response = await fetch(`/api/auth/passkeys/${credentialId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression");
      }

      toast({
        title: "Passkey supprimée",
        description: "La passkey a été supprimée.",
      });

      fetchSecurityStatus();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Sécurité du compte</h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos méthodes d'authentification
          </p>
        </div>
      </div>

      {/* ============ PASSKEYS SECTION ============ */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium">Passkeys</h3>
              <p className="text-sm text-muted-foreground">
                Connexion biométrique (Face ID, Touch ID, Windows Hello)
              </p>
            </div>
          </div>
          {webAuthnSupported && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              Supporté
            </span>
          )}
        </div>

        {!webAuthnSupported ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              Votre navigateur ne supporte pas les Passkeys. Utilisez Chrome, Safari ou Edge.
            </p>
          </div>
        ) : (
          <>
            {/* Liste des passkeys */}
            {status?.passkeys && status.passkeys.length > 0 ? (
              <div className="space-y-2">
                {status.passkeys.map((passkey) => {
                  const info = getPasskeyDisplayInfo(passkey);
                  return (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{info.icon}</span>
                        <div>
                          <p className="font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Dernière utilisation: {info.lastUsed}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePasskey(passkey.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune passkey enregistrée.
              </p>
            )}

            {/* Ajouter une passkey */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nom de la passkey (optionnel)"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={addPasskey} disabled={addingPasskey}>
                {addingPasskey ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Ajouter une Passkey
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ============ 2FA SECTION ============ */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-purple-500" />
            <div>
              <h3 className="font-medium">Authentification à deux facteurs (2FA)</h3>
              <p className="text-sm text-muted-foreground">
                Code temporaire via Google Authenticator ou similaire
              </p>
            </div>
          </div>
          {status?.twoFactorEnabled && (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Activé
            </span>
          )}
        </div>

        {status?.twoFactorEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-medium">2FA activé</p>
                <p className="text-sm">
                  Codes de récupération restants: {status.remainingRecoveryCodes}/10
                </p>
              </div>
            </div>
            {status.remainingRecoveryCodes < 3 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">
                  Il vous reste peu de codes de récupération. Pensez à les régénérer.
                </p>
              </div>
            )}
          </div>
        ) : showTOTPSetup ? (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <p className="text-sm text-muted-foreground text-center">
                Scannez ce QR code avec votre application d'authentification
              </p>
              {totpQRCode && (
                <img src={totpQRCode} alt="QR Code TOTP" className="w-48 h-48" />
              )}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Ou entrez ce code manuellement:</p>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {totpSecret}
                </code>
              </div>
            </div>

            {/* Codes de récupération */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <span className="font-medium">Codes de récupération</span>
                </div>
                <Button variant="ghost" size="sm" onClick={copyRecoveryCodes}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copier
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Conservez ces codes en lieu sûr. Ils permettent d'accéder à votre compte si vous perdez votre téléphone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, i) => (
                  <code key={i} className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            {/* Vérification */}
            <div className="space-y-3">
              <Label>Entrez le code affiché dans votre application</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="max-w-[150px] text-center font-mono text-lg"
                  maxLength={6}
                />
                <Button onClick={verify2FACode} disabled={activating2FA || verificationCode.length !== 6}>
                  {activating2FA ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Activer 2FA
                </Button>
              </div>
            </div>

            <Button variant="ghost" onClick={() => setShowTOTPSetup(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button onClick={startTOTPSetup}>
            <Smartphone className="h-4 w-4 mr-2" />
            Configurer 2FA
          </Button>
        )}
      </section>
    </div>
  );
}
