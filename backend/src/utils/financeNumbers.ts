import { Invoice } from "../modules/fees/fee.model";
import { Receipt } from "../modules/payments/payment.model";

/**
 * Finance document numbering (Phase 7).
 *  - Invoices: INV-<year>-<6-digit sequence>, e.g. INV-2026-000042.
 *  - Receipts: RCP-<year>-<6-digit sequence>, e.g. RCP-2026-000007.
 * Sequences are per calendar year. The unique indexes on invoiceNumber /
 * receiptNumber are the real guard: creators run inside a retry loop and
 * recompute the sequence on a duplicate-key error (same pattern as
 * utils/admissionNumber.ts).
 */
async function nextSequence(
  prefix: string,
  count: (rx: RegExp) => Promise<number>,
  lastValue: (rx: RegExp) => Promise<string | null>,
): Promise<string> {
  const rx = new RegExp(`^${prefix}`);
  const total = await count(rx);
  const last = await lastValue(rx);
  let seq = total + 1;
  if (last) {
    const lastSeq = Number.parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(lastSeq) && lastSeq >= seq) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export function invoiceNumberPrefix(year = new Date().getFullYear()): string {
  return `INV-${year}-`;
}
export async function nextInvoiceNumber(year = new Date().getFullYear()): Promise<string> {
  const prefix = invoiceNumberPrefix(year);
  return nextSequence(
    prefix,
    (rx) => Invoice.countDocuments({ invoiceNumber: rx }),
    async (rx) => (await Invoice.findOne({ invoiceNumber: rx }).sort({ invoiceNumber: -1 }).select("invoiceNumber").lean())?.invoiceNumber ?? null,
  );
}

export function receiptNumberPrefix(year = new Date().getFullYear()): string {
  return `RCP-${year}-`;
}
export async function nextReceiptNumber(year = new Date().getFullYear()): Promise<string> {
  const prefix = receiptNumberPrefix(year);
  return nextSequence(
    prefix,
    (rx) => Receipt.countDocuments({ receiptNumber: rx }),
    async (rx) => (await Receipt.findOne({ receiptNumber: rx }).sort({ receiptNumber: -1 }).select("receiptNumber").lean())?.receiptNumber ?? null,
  );
}
