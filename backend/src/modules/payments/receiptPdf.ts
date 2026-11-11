import PDFDocument from "pdfkit";

/**
 * Receipt PDF (§12) — pdfkit, generated from the stored Receipt record
 * (which exists only because its payment was verified). A reversed payment's
 * receipt is VOID and the PDF says so plainly instead of disappearing.
 * Amounts print as major units with 2 decimals; storage is integer minor units.
 */
type Row = Record<string, unknown>;
const fmt = (minor: unknown) => (Number(minor ?? 0) / 100).toFixed(2);
const nameOf = (v: unknown): string => {
  const o = (v && typeof v === "object" ? (v as Row) : {}) as Row;
  if (typeof o.name === "string") return o.name;
  if (typeof o.firstName === "string") return `${o.firstName} ${(o.lastName as string) ?? ""}`.trim();
  return "";
};

export function renderReceiptPdf(receipt: Row): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const invoice = (receipt.invoice ?? {}) as Row;
  const payment = (receipt.payment ?? {}) as Row;
  doc.fontSize(20).fillColor("#111827").text("School ERP", { align: "center" });
  doc.fontSize(13).fillColor("#2563EB").text("Payment Receipt", { align: "center" });
  if (receipt.status === "void") {
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor("#DC2626").text("VOID — PAYMENT REVERSED", { align: "center" });
    doc.fillColor("#111827");
    if (receipt.voidReason) doc.fontSize(10).text(`Reason: ${String(receipt.voidReason)}`, { align: "center" });
  }
  doc.moveDown(0.8);
  doc.fontSize(11);
  doc.text(`Receipt No: ${String(receipt.receiptNumber ?? "")}`);
  doc.text(`Invoice No: ${String(invoice.invoiceNumber ?? "")}`);
  doc.text(`Student: ${nameOf(receipt.student)}`);
  doc.text(`Admission No: ${String(((receipt.student ?? {}) as Row).admissionNumber ?? "")}`);
  doc.text(`Amount Received: ${fmt(receipt.amount)}`);
  doc.text(`Method: ${String(receipt.method ?? payment.method ?? "")}`);
  if (payment.reference) doc.text(`Reference: ${String(payment.reference)}`);
  doc.text(`Verified / Issued: ${receipt.issuedAt ? new Date(String(receipt.issuedAt)).toLocaleString() : ""}`);
  doc.text(`Issued By: ${nameOf(receipt.issuedBy)}`);
  doc.moveDown(1.5);
  doc.fontSize(9).fillColor("#64748B").text(
    "This receipt was generated only after the accounts office verified the payment. Keep it for your records.",
    { align: "center" },
  );
  doc.end();
  return doc;
}
