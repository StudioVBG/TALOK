import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import {
  PASSWORD_RESET_COOKIE_NAME,
  verifyPasswordResetCookieToken,
  validatePasswordResetRequestForCallback,
} from "@/lib/auth/password-recovery.service";
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
  params: {
    requestId: string;
  };
}

export default async function PasswordRecoveryPage({ params }: PasswordRecoveryPageProps) {
  noStore();

  const { requestId } = params;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(PASSWORD_RESET_COOKIE_NAME)?.value;
  const cookiePayload = verifyPasswordResetCookieToken(cookieToken);

  let canReset = false;

  if (cookiePayload && cookiePayload.requestId === requestId) {
    const validation = await validatePasswordResetRequestForCallback({
      requestId,
      userId: cookiePayload.userId,
    });
    canReset = validation.valid;
  }

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
          {canReset ? (
            <PasswordRecoveryForm requestId={requestId} />
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
