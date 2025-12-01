import { redirect } from "next/navigation";

// Redirection server-side vers le dashboard (plus efficace que client-side)
export default function AdminPage() {
  redirect("/admin/dashboard");
}
