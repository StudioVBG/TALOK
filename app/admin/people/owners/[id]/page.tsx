export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminOwnerDetails } from "../../../_data/fetchAdminOwnerDetails";
import { OwnerDetailsClient } from "./OwnerDetailsClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const ownerDetails = await fetchAdminOwnerDetails(id);

  if (!ownerDetails) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-xl">Propriétaire introuvable</CardTitle>
            <CardDescription className="text-base">
              Le propriétaire avec l&apos;identifiant <code className="bg-muted px-2 py-1 rounded text-sm">{id}</code> n&apos;existe pas ou a été supprimé.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/admin/people">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à l&apos;annuaire
              </Button>
            </Link>
            <Link href="/admin/people?tab=owners">
              <Button className="w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" />
                Rechercher un propriétaire
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <OwnerDetailsClient owner={ownerDetails} />;
}
