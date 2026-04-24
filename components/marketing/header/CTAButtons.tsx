import Link from "next/link";
import { Home } from "lucide-react";

export function CTAButtons() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/auth/signin"
        className="hidden items-center gap-2 rounded-lg border border-[#2563EB]/30 px-4 py-2 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#2563EB]/5 md:inline-flex"
      >
        <Home className="h-4 w-4" />
        Mon espace
      </Link>

      <Link
        href="/essai-gratuit"
        className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[#1d4ed8] active:scale-[0.98]"
      >
        Essai gratuit
      </Link>
    </div>
  );
}
