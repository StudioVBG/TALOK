import { redirect } from "next/navigation";

export default function ResetPasswordLegacyPage() {
  redirect("/auth/forgot-password");
}
