import { redirect } from "next/navigation";

export default function OwnersListRedirect() {
  redirect("/admin/people?tab=owners");
}
