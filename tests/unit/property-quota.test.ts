import { describe, expect, it } from "vitest";

import { buildPropertyQuotaSummary } from "@/lib/subscriptions/property-quota";

describe("buildPropertyQuotaSummary", () => {
  it("signale quand la vue est filtree et masque une partie du quota reel", () => {
    const summary = buildPropertyQuotaSummary({
      visibleCount: 1,
      totalCount: 3,
      limit: 3,
      hasScopedView: true,
    });

    expect(summary.usageLabel).toBe("3/3");
    expect(summary.showScopedHint).toBe(true);
    expect(summary.scopedHint).toContain("1 bien visible");
    expect(summary.scopedHint).toContain("3 comptés");
  });

  it("n'ajoute pas d'alerte quand la vue visible correspond au total reel", () => {
    const summary = buildPropertyQuotaSummary({
      visibleCount: 2,
      totalCount: 2,
      limit: 10,
      hasScopedView: true,
    });

    expect(summary.usageLabel).toBe("2/10");
    expect(summary.showScopedHint).toBe(false);
    expect(summary.scopedHint).toBeNull();
  });
});
