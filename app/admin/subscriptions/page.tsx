import { redirect } from "next/navigation";

/**
 * /admin/subscriptions is handled by the SubscriptionManagerDialog in the sidebar.
 * This page redirects to the dashboard to avoid rendering a duplicate UI.
 */
export default function AdminSubscriptionsRedirect() {
  redirect("/admin/dashboard");
}
