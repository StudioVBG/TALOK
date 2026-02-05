"use client";

import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SiretInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

function formatSiret(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 14);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 14),
  ].filter(Boolean);
  return parts.join(" ");
}

export function SiretInput({ value, onChange, error, disabled }: SiretInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(formatSiret(e.target.value));
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="siret">
        SIRET (14 chiffres) <span className="text-destructive">*</span>
      </Label>
      <Input
        id="siret"
        type="text"
        inputMode="numeric"
        value={formatSiret(value || "")}
        onChange={handleChange}
        placeholder="123 456 789 01234"
        maxLength={17}
        disabled={disabled}
        error={error}
        className="font-mono"
        aria-invalid={!!error}
        aria-required="true"
      />
    </div>
  );
}
