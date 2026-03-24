import { redirect } from "next/navigation";

/**
 * Redirection /inscription → /signup/role
 * Les landing pages utilisent /inscription comme URL marketing.
 * Le vrai parcours d'inscription est à /signup/role.
 */
export default function InscriptionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const plan = searchParams.plan;
  const target = plan ? `/signup/role?plan=${plan}` : "/signup/role";
  redirect(target);
}
