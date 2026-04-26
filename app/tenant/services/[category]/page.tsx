import { notFound } from "next/navigation";
import TenantServiceBookingClient from "./TenantServiceBookingClient";
import {
  TENANT_BOOKABLE_CATEGORIES,
  TENANT_BOOKABLE_CATEGORY_LABELS,
  type TenantBookableCategory,
} from "@/lib/tickets/tenant-service-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({
  params,
}: {
  params: { category: string };
}) {
  const category = params.category as TenantBookableCategory;
  if (!(TENANT_BOOKABLE_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  return (
    <TenantServiceBookingClient
      category={category}
      categoryLabel={TENANT_BOOKABLE_CATEGORY_LABELS[category]}
    />
  );
}
