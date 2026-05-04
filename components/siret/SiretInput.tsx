"use client";

/**
 * <SiretInput />
 *
 * Composant réutilisable d'identité légale.
 *
 * - Saisie 14 chiffres avec validation Luhn temps réel
 * - Bouton "Vérifier" qui appelle /api/siret/resolve
 * - Callback `onResolve(data)` quand l'API renvoie des données valides
 * - Callback `onError(reason)` quand la résolution échoue
 *
 * Usage typique :
 *   <SiretInput
 *     value={siret}
 *     onChange={setSiret}
 *     onResolve={(data) => fillForm(data)}
 *   />
 *
 * Le composant est purement présentationnel : il ne stocke pas de données
 * lui-même. La page parente est responsable de placer le résultat dans
 * son formulaire (RHF, useState, store…).
 */

import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSiret, isValidSiret } from "@/lib/entities/siret-validation";
import type { ResolvedLegalIdentity } from "@/lib/siret/types";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; siret: string }
  | { kind: "error"; reason: string; message: string };

interface SiretInputProps {
  value: string;
  onChange: (next: string) => void;
  onResolve: (data: ResolvedLegalIdentity) => void;
  onError?: (reason: string) => void;
  /** Désactive l'input + le bouton (ex: pendant un submit parent). */
  disabled?: boolean;
  /** Texte du label. Défaut : "SIRET (14 chiffres)" */
  label?: string;
  /** Affiche le message d'aide sous le label. Défaut : true */
  showHelp?: boolean;
  /** id HTML — utile pour <Label htmlFor>. Défaut : "siret" */
  id?: string;
}

export function SiretInput({
  value,
  onChange,
  onResolve,
  onError,
  disabled,
  label = "SIRET (14 chiffres)",
  showHelp = true,
  id = "siret",
}: SiretInputProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const digits = useMemo(() => value.replace(/\D/g, ""), [value]);
  const localValid = digits.length === 14 && isValidSiret(digits);
  const tooShort = digits.length > 0 && digits.length < 14;
  const luhnFails = digits.length === 14 && !localValid;

  const buttonDisabled = disabled || !localValid || status.kind === "checking";

  async function handleVerify() {
    if (!localValid) return;
    setStatus({ kind: "checking" });
    try {
      const res = await fetch("/api/siret/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siret: digits }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: ResolvedLegalIdentity;
        error?: string;
        reason?: string;
      };
      if (!res.ok || !payload.data) {
        const reason = payload.reason ?? "unknown";
        const message = payload.error ?? "Impossible de vérifier ce SIRET pour le moment.";
        setStatus({ kind: "error", reason, message });
        onError?.(reason);
        return;
      }
      setStatus({ kind: "ok", siret: digits });
      onResolve(payload.data);
    } catch {
      setStatus({
        kind: "error",
        reason: "network",
        message: "Connexion impossible à l'API. Vérifiez votre réseau puis réessayez.",
      });
      onError?.("network");
    }
  }

  function handleInputChange(raw: string) {
    const cleaned = raw.replace(/[^\d\s]/g, "").slice(0, 17);
    onChange(cleaned);
    // Tout changement après une vérif réussie repasse en idle
    if (status.kind !== "idle" && status.kind !== "checking") {
      setStatus({ kind: "idle" });
    }
  }

  const inputBorderClass =
    status.kind === "ok"
      ? "border-green-500 focus-visible:ring-green-500"
      : luhnFails || status.kind === "error"
        ? "border-destructive focus-visible:ring-destructive"
        : "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="123 456 789 01234"
          maxLength={17}
          disabled={disabled}
          className={inputBorderClass}
        />
        <Button type="button" variant="secondary" onClick={handleVerify} disabled={buttonDisabled} className="shrink-0">
          {status.kind === "checking" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vérification...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Vérifier
            </>
          )}
        </Button>
      </div>

      {showHelp && status.kind === "idle" && !tooShort && !luhnFails && (
        <p className="text-xs text-muted-foreground">
          Saisissez votre SIRET, nous récupérons automatiquement votre raison sociale, forme juridique, dirigeant, code
          NAF et N° TVA depuis le répertoire INSEE.
        </p>
      )}

      {tooShort && <p className="text-xs text-muted-foreground">{digits.length} / 14 chiffres</p>}

      {luhnFails && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Clé de contrôle invalide — vérifiez votre saisie.
        </p>
      )}

      {status.kind === "ok" && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Identité vérifiée auprès de l'INSEE — SIRET {formatSiret(status.siret)}
        </p>
      )}

      {status.kind === "error" && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{status.message}</span>
        </p>
      )}
    </div>
  );
}
