"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DepositTracker } from "@/components/payments/DepositTracker";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function DepositsPage() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeposits() {
      try {
        const res = await fetch("/api/deposits");
        if (res.ok) {
          const data = await res.json();
          setDeposits(data.deposits || []);
        }
      } catch (err) {
        console.error("[DepositsPage] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDeposits();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Dépôts de garantie</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DepositTracker deposits={deposits} />
      )}
    </div>
  );
}
