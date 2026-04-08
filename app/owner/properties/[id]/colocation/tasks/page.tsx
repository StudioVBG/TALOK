"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TaskCalendar } from "@/features/colocation/components/TaskCalendar";
import Link from "next/link";

export default function ColocationTasksPage() {
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
        <h1 className="text-2xl font-bold">Planning des taches</h1>
      </div>

      <TaskCalendar propertyId={propertyId} />
    </div>
  );
}
