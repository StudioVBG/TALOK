import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantsClient, type TenantWithDetails } from "@/app/owner/tenants/TenantsClient";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/owner/tenants",
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");

  const MotionDiv = ReactModule.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(function MotionDiv({ children, ...props }, ref) {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    );
  });

  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const tenantFixture: TenantWithDetails = {
  id: "tenant-1",
  profile_id: "profile-1",
  prenom: "Marie",
  nom: "Dupont",
  email: "marie.dupont@example.com",
  telephone: "0601020304",
  avatar_url: null,
  lease_id: "lease-1",
  lease_status: "active",
  lease_start: "2025-01-01",
  lease_end: null,
  lease_type: "nu",
  loyer: 900,
  charges: 100,
  property_id: "property-1",
  property_address: "12 rue des Lilas, Paris",
  property_city: "Paris",
  property_type: "appartement",
  payments_on_time: 6,
  payments_late: 0,
  payments_total: 6,
  current_balance: 0,
  last_payment_date: "2026-03-01",
  tenant_score: 5,
};

describe("TenantsClient", () => {
  it("affiche une carte locataire quand des données sont fournies", () => {
    render(<TenantsClient tenants={[tenantFixture]} />);

    expect(screen.getByText("Mes Locataires")).toBeInTheDocument();
    expect(screen.getByText("1 locataire affiché")).toBeInTheDocument();
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("12 rue des Lilas, Paris")).toBeInTheDocument();
  });
});
