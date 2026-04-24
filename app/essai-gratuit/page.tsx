import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EssaiGratuitPage() {
  // Envoie directement vers l'inscription gratuite (role=owner preselectionne,
  // skip la page de choix de role /signup/role).
  redirect("/signup/account?role=owner");
}
