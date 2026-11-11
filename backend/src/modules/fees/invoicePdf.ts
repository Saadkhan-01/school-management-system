import PDFDocument from "pdfkit";

/**
 * Fee challan PDF (§12) — rendered with pdfkit from the exact invoice record
 * the JSON endpoint returns (getChallanData), behind the same scope checks.
 * Amounts print as major units with 2 decimals; the stored values remain
 * integer minor units (see fee.model.ts money convention).
 */
type Row = Record<string, unknown>;
const fmt = (minor: unknown) => (Number(minor ?? 0) / 100).toFixed(2);
const nameOf = (v: unknown): string => {
  const o = (v && typeof v === "object" ? (v as Row) : {}) as Row;
  if (typeof o.name === "string") return o.name;
  if (typeof o.firstName === "string") return `${o.firstName} ${(o.lastName as string) ?? ""}`.trim();
  return "";
};

export function renderChallanPdf(inv: Row): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const student = (inv.student ?? {}) as Row;
  const enrollment = (inv.enrollment ?? {}) as Row;
  doc.fontSize(20).fillColor("#111827").text("School ERP", { align: "center" });
  doc.fontSize(13).fillColor("#2563EB").text("Fee Challan", { align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(11).fillColor("#111827");
  doc.text(`Challan / Invoice No: ${String(inv.invoiceNumber ?? "")}`);
  doc.text(`Student: ${nameOf(inv.student)}`);
  doc.text(`Admission No: ${String(student.admissionNumber ?? "")}`);
  doc.text(`Class: ${nameOf(enrollment.schoolClass)}${enrollment.section ? ` — Section ${nameOf(enrollment.section)}` : ""}`);
  doc.text(`Session: ${nameOf(inv.session)}`);
  doc.text(`Fee Structure: ${nameOf(inv.feeStructure)}${inv.periodLabel ? ` (${String(inv.periodLabel)})` : ""}`);
  doc.text(`Due Date: ${inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString() : ""}`);
  doc.text(`Status: ${String(inv.status ?? "")}`);
  doc.moveDown(1);

  const left = 48; const amtX = 430;
  doc.fontSize(11).text("Description", left, doc.y, { continued: true });
  doc.text("Amount", amtX, doc.y);
  doc.moveTo(left, doc.y + 2).lineTo(547, doc.y + 2).strokeColor("#2563EB").stroke();
  doc.moveDown(0.5);
  for (const li of (inv.lineItems as Row[]) ?? []) {
    const y = doc.y;
    doc.fontSize(10.5).text(String(li.label ?? ""), left, y);
    doc.text(fmt(li.amount), amtX, y);
    doc.moveDown(0.6);
  }
  for (const a of (inv.adjustments as Row[]) ?? []) {
    const y = doc.y;
    const negative = a.type === "discount" || a.type === "scholarship";
    doc.fontSize(10.5).fillColor(negative ? "#16A34A" : "#111827").text(`${String(a.label ?? "")} (${String(a.type ?? "")})`, left, y);
    doc.text(`${negative ? "-" : "+"}${fmt(a.amount)}`, amtX, y);
    doc.fillColor("#111827");
    doc.moveDown(0.6);
  }
  doc.moveTo(left, doc.y + 2).lineTo(547, doc.y + 2).strokeColor("#94A3B8").stroke();
  doc.moveDown(0.8);
  doc.fontSize(11.5).text(`Subtotal: ${fmt(inv.subtotal)}`);
  doc.text(`Total Due: ${fmt(inv.totalDue)}`);
  doc.text(`Amount Paid (verified only): ${fmt(inv.amountPaid)}`);
  doc.fontSize(12).text(`Balance: ${fmt(inv.balance)}`);
  doc.moveDown(1.5);
  doc.fontSize(9).fillColor("#64748B").text(
    "Pay at the school office or submit a manual payment with its reference from the parent portal. A receipt is issued only after the accounts office verifies a payment.",
    { align: "center" },
  );
  doc.end();
  return doc;
}
