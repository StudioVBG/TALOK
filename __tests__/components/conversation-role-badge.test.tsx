/**
 * Tests du badge ConversationRoleBadge (Sprint 3)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConversationRoleBadge } from "@/components/chat/conversation-role-badge";

describe("ConversationRoleBadge", () => {
  it("renders the correct label for each of the 4 roles", () => {
    const { rerender } = render(<ConversationRoleBadge role="owner" />);
    expect(screen.getByText("Propriétaire")).toBeInTheDocument();

    rerender(<ConversationRoleBadge role="tenant" />);
    expect(screen.getByText("Locataire")).toBeInTheDocument();

    rerender(<ConversationRoleBadge role="provider" />);
    expect(screen.getByText("Prestataire")).toBeInTheDocument();

    rerender(<ConversationRoleBadge role="admin" />);
    expect(screen.getByText("Support Talok")).toBeInTheDocument();
  });

  it("applies role-specific color classes", () => {
    const { container, rerender } = render(<ConversationRoleBadge role="owner" />);
    expect(container.firstChild).toHaveClass("bg-blue-50", "text-blue-700", "border-blue-200");

    rerender(<ConversationRoleBadge role="tenant" />);
    expect(container.firstChild).toHaveClass("bg-cyan-50", "text-cyan-700", "border-cyan-200");

    rerender(<ConversationRoleBadge role="provider" />);
    expect(container.firstChild).toHaveClass("bg-orange-50", "text-orange-700", "border-orange-200");

    rerender(<ConversationRoleBadge role="admin" />);
    expect(container.firstChild).toHaveClass("bg-green-50", "text-green-700", "border-green-200");
  });

  it("hides the icon when showIcon=false", () => {
    // showIcon=true → renders svg (lucide icon)
    const { container: withIcon } = render(<ConversationRoleBadge role="owner" showIcon />);
    expect(withIcon.querySelector("svg")).not.toBeNull();

    // showIcon=false → no svg
    const { container: withoutIcon } = render(<ConversationRoleBadge role="owner" showIcon={false} />);
    expect(withoutIcon.querySelector("svg")).toBeNull();
  });
});
