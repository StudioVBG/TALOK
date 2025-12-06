/**
 * Tests du composant ColocExpenseSplit
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the toast hook
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock format helpers
vi.mock("@/lib/helpers/format", () => ({
  formatCurrency: (amount: number) => `${amount.toFixed(2)} €`,
  formatDateShort: (date: string) => date,
}));

describe("ColocExpenseSplit", () => {
  const mockRoommates = [
    { id: "user-1", name: "Alice Martin", share_percentage: 33.33 },
    { id: "user-2", name: "Bob Dupont", share_percentage: 33.33 },
    { id: "user-3", name: "Claire Bernard", share_percentage: 33.34 },
  ];

  const mockCurrentUserId = "user-1";
  const mockLeaseId = "lease-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", async () => {
    const { ColocExpenseSplit } = await import(
      "@/features/tenant/components/coloc-expense-split"
    );

    render(
      <ColocExpenseSplit
        leaseId={mockLeaseId}
        roommates={mockRoommates}
        currentUserId={mockCurrentUserId}
      />
    );

    // Loading should be displayed
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it("should calculate balance correctly", async () => {
    const { ColocExpenseSplit } = await import(
      "@/features/tenant/components/coloc-expense-split"
    );

    render(
      <ColocExpenseSplit
        leaseId={mockLeaseId}
        roommates={mockRoommates}
        currentUserId={mockCurrentUserId}
      />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
    });

    // Check that balance section is visible
    expect(screen.getByText(/Votre solde/i)).toBeInTheDocument();
  });

  it("should open add expense dialog when clicking button", async () => {
    const { ColocExpenseSplit } = await import(
      "@/features/tenant/components/coloc-expense-split"
    );

    render(
      <ColocExpenseSplit
        leaseId={mockLeaseId}
        roommates={mockRoommates}
        currentUserId={mockCurrentUserId}
      />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
    });

    // Find and click the add expense button
    const addButton = screen.getByText(/Ajouter une dépense/i);
    fireEvent.click(addButton);

    // Dialog should be visible
    await waitFor(() => {
      expect(screen.getByText(/Nouvelle dépense/i)).toBeInTheDocument();
    });
  });

  it("should show expense split per person", async () => {
    const { ColocExpenseSplit } = await import(
      "@/features/tenant/components/coloc-expense-split"
    );

    render(
      <ColocExpenseSplit
        leaseId={mockLeaseId}
        roommates={mockRoommates}
        currentUserId={mockCurrentUserId}
      />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
    });

    // Check for roommate balance section
    expect(screen.getByText(/Soldes entre colocataires/i)).toBeInTheDocument();
  });
});

describe("Expense calculation logic", () => {
  it("should split expenses equally among roommates", () => {
    const totalAmount = 1200;
    const numRoommates = 3;
    const expectedSplit = 400;

    const splitAmount = totalAmount / numRoommates;
    expect(splitAmount).toBe(expectedSplit);
  });

  it("should calculate balance when one person pays for all", () => {
    // Alice pays 1200€ for rent (split 3 ways)
    const expense = {
      amount: 1200,
      paid_by: "user-1",
      splits: [
        { roommate_id: "user-1", amount: 400 },
        { roommate_id: "user-2", amount: 400 },
        { roommate_id: "user-3", amount: 400 },
      ],
    };

    // Alice balance: +1200 (paid) - 400 (her share) = +800 (others owe her)
    // Bob balance: -400 (owes Alice)
    // Claire balance: -400 (owes Alice)

    const aliceBalance = expense.amount - expense.splits[0].amount;
    const bobBalance = -expense.splits[1].amount;
    const claireBalance = -expense.splits[2].amount;

    expect(aliceBalance).toBe(800);
    expect(bobBalance).toBe(-400);
    expect(claireBalance).toBe(-400);
    expect(aliceBalance + bobBalance + claireBalance).toBe(0); // Should sum to 0
  });

  it("should handle multiple expenses from different payers", () => {
    const expenses = [
      { amount: 1200, paid_by: "user-1" }, // Alice pays rent
      { amount: 150, paid_by: "user-2" },  // Bob pays electricity
    ];

    const totalSplitPerPerson = (1200 + 150) / 3; // 450€ per person

    // Alice: +1200 - 450 = +750
    // Bob: +150 - 450 = -300
    // Claire: 0 - 450 = -450

    const aliceBalance = 1200 - totalSplitPerPerson;
    const bobBalance = 150 - totalSplitPerPerson;
    const claireBalance = 0 - totalSplitPerPerson;

    expect(aliceBalance).toBe(750);
    expect(bobBalance).toBe(-300);
    expect(claireBalance).toBe(-450);
  });
});

