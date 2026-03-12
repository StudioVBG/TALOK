import { describe, expect, it } from "vitest";
import { getCoreShellMetadata } from "@/lib/navigation/core-shell-metadata";

describe("getCoreShellMetadata", () => {
  it("retourne une description orientee action pour le dashboard owner", () => {
    const metadata = getCoreShellMetadata({
      role: "owner",
      pathname: "/owner/dashboard",
      fallbackTitle: "Tableau de bord",
    });

    expect(metadata.roleLabel).toBe("Proprietaire");
    expect(metadata.description).toContain("Priorisez");
  });

  it("retourne une description de parcours pour le dashboard tenant", () => {
    const metadata = getCoreShellMetadata({
      role: "tenant",
      pathname: "/tenant/dashboard",
      fallbackTitle: "Tableau de bord",
    });

    expect(metadata.roleLabel).toBe("Locataire");
    expect(metadata.description).toContain("actions importantes");
  });

  it("retourne une description orientee priorisation pour admin", () => {
    const metadata = getCoreShellMetadata({
      role: "admin",
      pathname: "/admin/dashboard",
      fallbackTitle: "Tableau de bord",
    });

    expect(metadata.roleLabel).toBe("Admin");
    expect(metadata.description).toContain("bloquants");
  });

  it("utilise la description par defaut pour une route non specifique", () => {
    const metadata = getCoreShellMetadata({
      role: "owner",
      pathname: "/owner/messages",
      fallbackTitle: "Messages",
    });

    expect(metadata.title).toBe("Messages");
    expect(metadata.description).toContain("debloque");
  });
});
