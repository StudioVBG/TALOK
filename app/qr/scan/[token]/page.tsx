export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import QRScanClient from "./QRScanClient";

export async function generateMetadata() {
  return {
    title: "Confirmer | Talok",
    description: "Confirmez l'action depuis votre mobile",
  };
}

export default async function QRScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-slate-500">
            Ce lien Talok est invalide ou a expiré. Demandez un nouveau QR code.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signin?redirect_to=${encodeURIComponent(`/qr/scan/${token}`)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 max-w-lg space-y-6">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        }
      >
        <QRScanClient token={token} />
      </Suspense>
    </div>
  );
}
