/**
 * Unit tests for computeNextPeriod — the pure helper that decides which
 * accounting period to create when no open exercise covers today.
 *
 * Covers:
 *  - Chains from the latest existing exercise (end_date + 1, span 1 year)
 *  - Honours entity's configured first exercise when no exercise exists
 *  - Projects the configured period forward when today is past the
 *    configured first-exercise end (handles non-calendar fiscal years)
 *  - Falls back to the calendar year when no config is set
 */

import { describe, expect, it } from "vitest";

import { computeNextPeriod } from "@/lib/accounting/auto-exercise";

describe("computeNextPeriod", () => {
  it("chains from the latest exercise's end_date on a 1-year span", () => {
    const period = computeNextPeriod(
      {
        premier_exercice_debut: "2024-01-01",
        premier_exercice_fin: "2024-12-31",
        date_cloture_exercice: "12-31",
      },
      "2026-12-31",
      new Date("2027-04-15T00:00:00Z"),
    );

    expect(period).toEqual({ start: "2027-01-01", end: "2027-12-31" });
  });

  it("chains across a non-calendar fiscal year (01/07 -> 30/06)", () => {
    const period = computeNextPeriod(
      {
        premier_exercice_debut: "2024-07-01",
        premier_exercice_fin: "2025-06-30",
        date_cloture_exercice: "06-30",
      },
      "2025-06-30",
      new Date("2025-09-01T00:00:00Z"),
    );

    expect(period).toEqual({ start: "2025-07-01", end: "2026-06-30" });
  });

  it("uses the configured first exercise when no exercise exists yet", () => {
    const period = computeNextPeriod(
      {
        premier_exercice_debut: "2026-03-15",
        premier_exercice_fin: "2026-12-31",
        date_cloture_exercice: "12-31",
      },
      null,
      new Date("2026-04-27T00:00:00Z"),
    );

    expect(period).toEqual({ start: "2026-03-15", end: "2026-12-31" });
  });

  it("projects the configured period forward when today is past first-exercise end", () => {
    const period = computeNextPeriod(
      {
        premier_exercice_debut: "2024-07-01",
        premier_exercice_fin: "2025-06-30",
        date_cloture_exercice: "06-30",
      },
      null,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(period).toEqual({ start: "2026-07-01", end: "2027-06-30" });
  });

  it("falls back to the calendar year when nothing is configured", () => {
    const period = computeNextPeriod(
      {
        premier_exercice_debut: null,
        premier_exercice_fin: null,
        date_cloture_exercice: null,
      },
      null,
      new Date("2026-04-27T00:00:00Z"),
    );

    expect(period).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});
