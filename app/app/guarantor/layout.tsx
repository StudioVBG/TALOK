// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GuarantorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Note: Le rôle garant peut être vérifié ici si nécessaire
  // Pour l'instant, on permet l'accès à tous les utilisateurs authentifiés

  return <>{children}</>;
}

