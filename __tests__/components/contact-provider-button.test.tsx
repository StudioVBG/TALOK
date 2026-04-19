/**
 * Tests du bouton ContactProviderButton (Sprint 4)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// --- Mocks ---
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const toastFn = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastFn }),
}));

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

const { getOrCreateOwnerProvider, getOrCreateTenantProvider } = vi.hoisted(() => ({
  getOrCreateOwnerProvider: vi.fn(),
  getOrCreateTenantProvider: vi.fn(),
}));
vi.mock("@/lib/services/chat.service", () => ({
  chatService: {
    getOrCreateOwnerProviderConversation: getOrCreateOwnerProvider,
    getOrCreateTenantProviderConversation: getOrCreateTenantProvider,
  },
}));

// --- Component under test (imported AFTER mocks) ---
import { ContactProviderButton } from "@/components/tickets/contact-provider-button";

const baseProps = {
  ticketId: "ticket-1",
  propertyId: "property-1",
  providerProfileId: "provider-1",
  providerName: "Marie",
};

describe("ContactProviderButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "profile-1" } }),
    });
  });

  it("renders the button with the provider name", () => {
    render(<ContactProviderButton {...baseProps} viewerRole="owner" />);
    expect(screen.getByRole("button", { name: /Contacter Marie/i })).toBeInTheDocument();
  });

  it("calls getOrCreateOwnerProviderConversation when viewerRole=owner", async () => {
    getOrCreateOwnerProvider.mockResolvedValue({ id: "conv-1" });

    render(<ContactProviderButton {...baseProps} viewerRole="owner" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(getOrCreateOwnerProvider).toHaveBeenCalledWith({
        ticket_id: "ticket-1",
        property_id: "property-1",
        owner_profile_id: "profile-1",
        provider_profile_id: "provider-1",
      });
    });
    expect(routerPush).toHaveBeenCalledWith("/owner/messages?conversation=conv-1");
  });

  it("calls getOrCreateTenantProviderConversation when viewerRole=tenant", async () => {
    getOrCreateTenantProvider.mockResolvedValue({ id: "conv-2" });

    render(<ContactProviderButton {...baseProps} viewerRole="tenant" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(getOrCreateTenantProvider).toHaveBeenCalledWith({
        ticket_id: "ticket-1",
        property_id: "property-1",
        tenant_profile_id: "profile-1",
        provider_profile_id: "provider-1",
      });
    });
    expect(routerPush).toHaveBeenCalledWith("/tenant/messages?conversation=conv-2");
  });

  it("shows a destructive toast when the service throws", async () => {
    getOrCreateOwnerProvider.mockRejectedValue(new Error("network down"));

    render(<ContactProviderButton {...baseProps} viewerRole="owner" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "network down",
        })
      );
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("disables the button while creating", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    getOrCreateOwnerProvider.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<ContactProviderButton {...baseProps} viewerRole="owner" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText(/Création/)).toBeInTheDocument();

    resolveCreate({ id: "conv-x" });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
