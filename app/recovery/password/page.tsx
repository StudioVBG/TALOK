import { unstable_noStore as noStore } from "next/cache";
import { verifyPasswordResetToken } from "@/lib/auth/password-recovery.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordRecoveryForm } from "./PasswordRecoveryForm";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface PasswordRecoveryPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function PasswordRecoveryPage({ searchParams }: PasswordRecoveryPageProps) {
  noStore();

  const params = await searchParams;
  const token = params?.token;
  const result = token ? verifyPasswordResetToken(token) : null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Changement sécurisé du mot de passe</CardTitle>
          <CardDescription>
            Cette page est accessible uniquement via le lien unique reçu par email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result && token ? (
            <PasswordRecoveryForm token={token} />
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Ce lien de changement de mot de passe est invalide, expiré ou déjà utilisé.</p>
              <p>Pour votre sécurité, chaque demande donne accès à une page dédiée à usage unique.</p>
              <a href="/auth/forgot-password" className="text-primary underline-offset-2 hover:underline">
                Demander un nouveau lien
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
