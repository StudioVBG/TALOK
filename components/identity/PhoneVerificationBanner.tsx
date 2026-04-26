import Link from "next/link";
import { Phone } from "lucide-react";

interface PhoneVerificationBannerProps {
  identityStatus: string | null | undefined;
  pathname?: string;
}

/**
 * Bannière persistante affichée aux utilisateurs ayant différé la
 * vérification téléphone (`identity_status === 'phone_skipped'`).
 * Renvoie null pour tout autre statut.
 */
export function PhoneVerificationBanner({
  identityStatus,
  pathname,
}: PhoneVerificationBannerProps) {
  if (identityStatus !== "phone_skipped") return null;

  const target = pathname
    ? `/onboarding/phone?from=${encodeURIComponent(pathname)}`
    : "/onboarding/phone";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">Téléphone non vérifié.</span>{" "}
            La signature de baux et les paiements sont indisponibles tant que votre numéro n&apos;est pas confirmé.
          </p>
        </div>
        <Link
          href={target}
          className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        >
          Vérifier maintenant
        </Link>
      </div>
    </div>
  );
}
