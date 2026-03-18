import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lien de changement sécurisé requis</CardTitle>
          <CardDescription>
            Cette route publique n'est plus utilisée pour modifier directement le mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Pour votre sécurité, le changement de mot de passe se fait désormais via une page dédiée
            à usage unique, accessible uniquement depuis le lien envoyé par email.
          </p>
          <a href="/auth/forgot-password" className="text-primary underline-offset-2 hover:underline">
            Demander un nouveau lien sécurisé
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

