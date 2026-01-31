import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLinks, MainContent, MainNavigation } from "@/components/ui/skip-links";

describe("SkipLinks", () => {
  it("renders default skip links", () => {
    render(<SkipLinks />);

    expect(screen.getByText("Aller au contenu principal")).toBeInTheDocument();
    expect(screen.getByText("Aller à la navigation")).toBeInTheDocument();
  });

  it("renders custom skip links", () => {
    const customLinks = [
      { href: "#search", label: "Aller à la recherche" },
      { href: "#footer", label: "Aller au pied de page" },
    ];

    render(<SkipLinks links={customLinks} />);

    expect(screen.getByText("Aller à la recherche")).toBeInTheDocument();
    expect(screen.getByText("Aller au pied de page")).toBeInTheDocument();
  });

  it("links have correct href attributes", () => {
    render(<SkipLinks />);

    const mainLink = screen.getByText("Aller au contenu principal");
    expect(mainLink).toHaveAttribute("href", "#main-content");

    const navLink = screen.getByText("Aller à la navigation");
    expect(navLink).toHaveAttribute("href", "#main-navigation");
  });

  it("links are visually hidden by default (sr-only)", () => {
    render(<SkipLinks />);

    const link = screen.getByText("Aller au contenu principal");
    expect(link).toHaveClass("sr-only");
  });
});

describe("MainContent", () => {
  it("renders with correct id for skip link target", () => {
    render(<MainContent>Content here</MainContent>);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabIndex", "-1");
  });

  it("renders children", () => {
    render(<MainContent><p>Test content</p></MainContent>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<MainContent className="custom-class">Content</MainContent>);
    expect(screen.getByRole("main")).toHaveClass("custom-class");
  });
});

describe("MainNavigation", () => {
  it("renders with correct id and aria-label", () => {
    render(<MainNavigation>Nav items</MainNavigation>);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("id", "main-navigation");
    expect(nav).toHaveAttribute("aria-label", "Navigation principale");
  });

  it("renders children", () => {
    render(<MainNavigation><a href="/">Home</a></MainNavigation>);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
