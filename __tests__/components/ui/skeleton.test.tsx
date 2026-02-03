import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders with default props", () => {
    render(<Skeleton />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveAttribute("aria-live", "polite");
  });

  it("renders with custom sr-only text", () => {
    render(<Skeleton srText="Chargement des données..." />);
    expect(screen.getByText("Chargement des données...")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Skeleton className="custom-class" />);
    expect(screen.getByRole("status")).toHaveClass("custom-class");
  });
});

describe("SkeletonText", () => {
  it("renders default 3 lines", () => {
    render(<SkeletonText />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton.children).toHaveLength(3);
  });

  it("renders custom number of lines", () => {
    render(<SkeletonText lines={5} />);
    expect(screen.getByRole("status").children).toHaveLength(5);
  });
});

describe("SkeletonCard", () => {
  it("renders card skeleton with aria attributes", () => {
    render(<SkeletonCard />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveClass("rounded-lg", "border");
  });

  it("applies custom className", () => {
    render(<SkeletonCard className="w-full" />);
    expect(screen.getByRole("status")).toHaveClass("w-full");
  });
});

describe("SkeletonAvatar", () => {
  it("renders medium size by default", () => {
    render(<SkeletonAvatar />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveClass("h-10", "w-10", "rounded-full");
  });

  it("renders small size", () => {
    render(<SkeletonAvatar size="sm" />);
    expect(screen.getByRole("status")).toHaveClass("h-8", "w-8");
  });

  it("renders large size", () => {
    render(<SkeletonAvatar size="lg" />);
    expect(screen.getByRole("status")).toHaveClass("h-12", "w-12");
  });
});
