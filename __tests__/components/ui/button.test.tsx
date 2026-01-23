import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, IconButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders with different variants", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary");

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("border");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("hover:bg-accent");
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-11");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-11", "w-11");
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state", () => {
    render(<Button isLoading>Loading</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/chargement en cours/i)).toBeInTheDocument();
  });

  it("shows custom loading text", () => {
    render(<Button isLoading loadingText="Envoi en cours...">Submit</Button>);
    expect(screen.getByText("Envoi en cours...")).toBeInTheDocument();
  });

  it("renders with left icon", () => {
    render(<Button leftIcon={<Plus data-testid="left-icon" />}>Add</Button>);
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("renders with right icon", () => {
    render(<Button rightIcon={<Plus data-testid="right-icon" />}>Add</Button>);
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });

  it("hides icons when loading", () => {
    render(
      <Button
        isLoading
        leftIcon={<Plus data-testid="left-icon" />}
        rightIcon={<Plus data-testid="right-icon" />}
      >
        Submit
      </Button>
    );

    expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
  });
});

describe("IconButton", () => {
  it("renders with required aria-label", () => {
    render(
      <IconButton
        aria-label="Add item"
        icon={<Plus data-testid="icon" />}
      />
    );

    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("applies icon size by default", () => {
    render(
      <IconButton
        aria-label="Add"
        icon={<Plus />}
      />
    );

    expect(screen.getByRole("button")).toHaveClass("h-11", "w-11");
  });

  it("handles loading state", () => {
    render(
      <IconButton
        aria-label="Add"
        icon={<Plus />}
        isLoading
      />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
