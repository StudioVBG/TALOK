"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RulesEditor } from "@/features/colocation/components/RulesEditor";
import Link from "next/link";

export default function ColocationRulesPage() {
  const params = useParams();
  const propertyId = params.id as string;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/owner/properties/${propertyId}/colocation`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Reglement interieur</h1>
      </div>

      <RulesEditor propertyId={propertyId} />
    </div>
  );
}
