export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import KeyHandoverConfirmClient from "./KeyHandoverConfirmClient";

export async function generateMetadata() {
  return {
    title: "Remise des clés | Talok",
    description: "Confirmez la réception de vos clés",
  };
}

async function VerifyContent({ token, leaseId }: { token: string; leaseId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signin?redirect_to=${encodeURIComponent(`/key-handover/verify?token=${token}&lease=${leaseId}`)}`);
  }

  return (
    <KeyHandoverConfirmClient token={token} leaseId={leaseId} />
  );
}

export default async function KeyHandoverVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; lease?: string }>;
}) {
  const { token, lease: leaseId } = await searchParams;

  if (!token || !leaseId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-slate-500">
            Ce lien de remise des clés est invalide. Demandez un nouveau QR code à votre propriétaire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 max-w-lg space-y-6">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        }
      >
        <VerifyContent token={token} leaseId={leaseId} />
      </Suspense>
    </div>
  );
}
