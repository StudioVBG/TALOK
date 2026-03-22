"use client";

import { Check } from "lucide-react";

const CHECKS = [
  "Assistant pas-à-pas en 5 étapes",
  "Signature en ligne (pas besoin d'imprimer)",
  "État des lieux numérique avec photos",
  "Révision de loyer calculée automatiquement",
];

export function FeatureBaux() {
  return (
    <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div>
        <span className="inline-block rounded-full bg-talok-bleu-marque/10 px-3 py-1 text-xs font-semibold text-talok-bleu-marque">
          Baux &amp; documents
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-foreground md:text-3xl">
          Créez un bail complet en 5 minutes
        </h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Fini les modèles Word trouvés sur Google. Talok génère des baux
          conformes au droit français, prêts à signer en ligne. État des lieux,
          quittances, avenants — tout est rangé au même endroit.
        </p>
        <ul className="mt-6 space-y-3">
          {CHECKS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-bleu-marque" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Mockup: Stepper bail meublé */}
      <div className="rounded-2xl border bg-white p-6 shadow-lg">
        {/* Stepper header */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  n <= 3
                    ? "bg-talok-bleu-marque text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {n}
              </div>
              {n < 5 && (
                <div
                  className={`h-0.5 w-6 ${
                    n < 3 ? "bg-talok-bleu-marque" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Étape 3/5 — Loyer et charges</p>

        <div className="mt-5 space-y-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Type de bail</span>
            <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-foreground">
              Bail meublé
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Loyer mensuel</span>
              <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm font-semibold text-foreground">
                1 250 €
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Charges</span>
              <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm font-semibold text-foreground">
                150 €
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Dépôt de garantie</span>
            <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm font-semibold text-foreground">
              1 250 €
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
