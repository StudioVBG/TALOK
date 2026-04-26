/**
 * RLS matrix snapshot tests.
 *
 * For every accounting table we own, we encode the expected set of
 * (policyname, cmd) pairs that must exist after the P0 + MV + manifest
 * migrations are applied. Any drift — a missing policy, an extra public
 * INSERT — fails the test. This is the security backbone we plug into
 * CI so a future PR cannot silently widen RLS.
 *
 * The snapshot is *static* — applying it to a real database is done by
 * the CI job that runs `psql -f tests/sql/dump-accounting-policies.sql`
 * and compares the result with this fixture. The unit test here just
 * validates the fixture's internal consistency (no duplicates, no
 * unexpected commands, every table has a SELECT policy).
 */

import { describe, expect, it } from "vitest";

interface PolicyEntry {
  cmd: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  /** Roles allowed to satisfy the policy. authenticated unless noted. */
  to?: "authenticated" | "service_role" | "anon" | "public";
}

const RLS_MATRIX: Record<string, Record<string, PolicyEntry>> = {
  accounting_exercises: {
    accounting_exercises_entity_access: { cmd: "ALL" },
  },
  chart_of_accounts: {
    coa_entity_access: { cmd: "ALL" },
  },
  accounting_journals: {
    journals_entity_access: { cmd: "ALL" },
  },
  accounting_entries: {
    entries_entity_access: { cmd: "ALL" },
  },
  accounting_entry_lines: {
    entry_lines_via_entry: { cmd: "ALL" },
  },
  bank_connections: {
    bank_conn_entity_access: { cmd: "ALL" },
  },
  bank_transactions: {
    bank_tx_via_connection: { cmd: "ALL" },
  },
  document_analyses: {
    doc_analyses_entity_access: { cmd: "ALL" },
  },
  amortization_schedules: {
    amort_sched_entity_access: { cmd: "ALL" },
  },
  amortization_lines: {
    amort_lines_via_schedule: { cmd: "ALL" },
  },
  deficit_tracking: {
    deficit_entity_access: { cmd: "ALL" },
  },
  charge_regularizations: {
    charge_reg_entity_access: { cmd: "ALL" },
  },
  ec_access: {
    ec_access_owner_or_ec: { cmd: "ALL" },
  },
  // Post-P0 fix: ec_annotations now has 4 split policies
  ec_annotations: {
    ec_annotations_select: { cmd: "SELECT" },
    ec_annotations_insert: { cmd: "INSERT" },
    ec_annotations_update: { cmd: "UPDATE" },
    ec_annotations_delete: { cmd: "DELETE" },
  },
  copro_budgets: {
    copro_budgets_entity_access: { cmd: "ALL" },
  },
  copro_fund_calls: {
    copro_calls_entity_access: { cmd: "ALL" },
  },
  mandant_accounts: {
    mandant_entity_access: { cmd: "ALL" },
  },
  crg_reports: {
    crg_entity_access: { cmd: "ALL" },
  },
  // Post-P0 fix: audit log INSERT policy was DROPPED. Only SELECT remains.
  accounting_audit_log: {
    audit_log_entity_access: { cmd: "SELECT" },
  },
  // Post-FEC-manifest migration
  fec_manifests: {
    fec_manifests_select: { cmd: "SELECT" },
  },
};

describe("RLS matrix — internal consistency", () => {
  const tableNames = Object.keys(RLS_MATRIX);

  it("covers every accounting table once", () => {
    expect(new Set(tableNames).size).toBe(tableNames.length);
  });

  it("enforces that every table has either a SELECT or ALL policy", () => {
    for (const [table, policies] of Object.entries(RLS_MATRIX)) {
      const cmds = Object.values(policies).map((p) => p.cmd);
      const hasReadAccess = cmds.includes("SELECT") || cmds.includes("ALL");
      expect(
        hasReadAccess,
        `table ${table} must expose at least SELECT or ALL`,
      ).toBe(true);
    }
  });

  it("never grants public/anon write access on any accounting table", () => {
    for (const [table, policies] of Object.entries(RLS_MATRIX)) {
      for (const [name, policy] of Object.entries(policies)) {
        const role = policy.to ?? "authenticated";
        const isWrite =
          policy.cmd === "INSERT" ||
          policy.cmd === "UPDATE" ||
          policy.cmd === "DELETE" ||
          policy.cmd === "ALL";
        if (isWrite) {
          expect(
            role,
            `${table}.${name} grants ${policy.cmd} to ${role}`,
          ).toBe("authenticated");
        }
      }
    }
  });

  it("post-P0: ec_annotations exposes the 4 split CRUD policies", () => {
    const cmds = Object.values(RLS_MATRIX.ec_annotations).map((p) => p.cmd);
    expect(cmds).toEqual(
      expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"]),
    );
    expect(cmds).not.toContain("ALL"); // the legacy "FOR ALL" was dropped
  });

  it("post-P0: accounting_audit_log no longer exposes INSERT to authenticated", () => {
    const cmds = Object.values(RLS_MATRIX.accounting_audit_log).map(
      (p) => p.cmd,
    );
    expect(cmds).toContain("SELECT");
    expect(cmds).not.toContain("INSERT");
    expect(cmds).not.toContain("ALL");
  });

  it("post-FEC: fec_manifests only exposes SELECT (inserts via service role)", () => {
    const cmds = Object.values(RLS_MATRIX.fec_manifests).map((p) => p.cmd);
    expect(cmds).toEqual(["SELECT"]);
  });
});
