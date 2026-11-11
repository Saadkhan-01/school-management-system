import { describe, it, expect } from "vitest";
import { computeInvoiceTotals, computeInvoiceStatus } from "../../src/modules/fees/fee.model";
import { gradeFor } from "../../src/modules/examinations/exam.service";
import { computeFineMinor } from "../../src/modules/library/library.model";
import { audiencesForRole } from "../../src/modules/portal/portal.service";

/**
 * §36 unit tests for pure business logic (no DB needed):
 * money math in integer minor units, grading-scale lookup, library fine
 * computation, announcement audience scoping, invoice status derivation.
 * (Invoice/admission NUMBER formats are asserted in the integration suites,
 * where the numbers are genuinely generated against the DB.)
 */
describe("invoice money math (integer minor units)", () => {
  const items = [
    { label: "Tuition", amount: 500000 },
    { label: "Transport", amount: 75000 },
  ];
  it("sums line items to the total due", () => {
    const t = computeInvoiceTotals(items, []);
    expect(t.subtotal).toBe(575000);
    expect(t.totalDue).toBe(575000);
    expect(Number.isInteger(t.totalDue)).toBe(true);
  });
  it("applies discount and surcharge adjustments in order", () => {
    const t = computeInvoiceTotals(items, [
      { label: "Sibling discount", type: "discount", amount: 50000 },
      { label: "Late fee", type: "surcharge", amount: 2500 },
    ]);
    expect(t.totalDue).toBe(527500);
  });
  it("never lets a discount drive the total below zero", () => {
    const t = computeInvoiceTotals(items, [{ label: "Full waiver", type: "discount", amount: 9999999 }]);
    expect(t.totalDue).toBe(0);
  });
  it("derives invoice status from paid vs due (future due date)", () => {
    const future = new Date(Date.now() + 7 * 86_400_000);
    const inv = (totalDue: number, amountPaid: number) => ({ totalDue, amountPaid, dueDate: future, status: "unpaid" as const });
    expect(computeInvoiceStatus(inv(1000, 0))).toBe("unpaid");
    expect(computeInvoiceStatus(inv(1000, 400))).toBe("partially-paid");
    expect(computeInvoiceStatus(inv(1000, 1000))).toBe("paid");
    expect(computeInvoiceStatus(inv(0, 0))).toBe("paid");
  });
  it("marks an unpaid invoice overdue once its due date passes, and never overrides cancelled", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(computeInvoiceStatus({ totalDue: 1000, amountPaid: 0, dueDate: past, status: "unpaid" })).toBe("overdue");
    expect(computeInvoiceStatus({ totalDue: 1000, amountPaid: 0, dueDate: past, status: "cancelled" })).toBe("cancelled");
  });
});

describe("grading scale lookup (gradeFor)", () => {
  const scale = {
    ranges: [
      { min: 90, max: 100, grade: "A+", points: 4 },
      { min: 80, max: 89, grade: "A", points: 3.7 },
      { min: 50, max: 59, grade: "D", points: 1 },
      { min: 0, max: 49, grade: "F", points: 0 },
    ],
  };
  it("maps boundary percentages to the right band", () => {
    expect(gradeFor(100, scale)?.grade).toBe("A+");
    expect(gradeFor(90, scale)?.grade).toBe("A+");
    expect(gradeFor(89, scale)?.grade).toBe("A");
    expect(gradeFor(50, scale)?.grade).toBe("D");
    expect(gradeFor(49, scale)?.grade).toBe("F");
    expect(gradeFor(0, scale)?.grade).toBe("F");
  });
  it("returns null outside every band or without a scale", () => {
    expect(gradeFor(101, scale)).toBeNull();
    expect(gradeFor(-1, scale)).toBeNull();
    expect(gradeFor(85, null)).toBeNull();
  });
});

describe("library fine computation (minor units, 500 per WHOLE day past the due date)", () => {
  const due = new Date("2026-01-15T10:00:00Z"); // issue date + 14-day loan period
  it("is zero when returned on or before the due date", () => {
    expect(computeFineMinor(due, new Date("2026-01-10T10:00:00Z"))).toBe(0);
    expect(computeFineMinor(due, new Date("2026-01-15T10:00:00Z"))).toBe(0); // exactly due
    expect(computeFineMinor(due, new Date("2026-01-15T22:00:00Z"))).toBe(0); // partial day → floored
  });
  it("multiplies per whole overdue day", () => {
    expect(computeFineMinor(due, new Date("2026-01-16T10:00:00Z"))).toBe(500); // 1 day
    expect(computeFineMinor(due, new Date("2026-01-18T10:00:00Z"))).toBe(1500); // 3 days
    expect(computeFineMinor(due, new Date("2026-01-25T10:00:00Z"))).toBe(5000); // 10 days
  });
});

describe("announcement audiences per role (audiencesForRole)", () => {
  it("gives a student the student + whole-school audiences", () => {
    expect(audiencesForRole("student")).toEqual(expect.arrayContaining(["students", "all"]));
    expect(audiencesForRole("student")).not.toContain("teachers");
  });
  it("gives a parent the parent + whole-school audiences", () => {
    expect(audiencesForRole("parent")).toEqual(expect.arrayContaining(["parents", "all"]));
    expect(audiencesForRole("parent")).not.toContain("students");
  });
  it("gives staff roles their staff audiences", () => {
    expect(audiencesForRole("teacher")).toEqual(expect.arrayContaining(["teachers", "staff", "all"]));
    expect(audiencesForRole("accountant")).toEqual(expect.arrayContaining(["staff", "all"]));
  });
});
