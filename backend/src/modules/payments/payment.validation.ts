import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const money = z.number({ invalid_type_error: "Amount must be a number of integer minor units" })
  .int("Amounts must be integer minor units (no decimals)").min(1, "Amount must be at least 1 minor unit").max(1_000_000_000_000);

/**
 * Manual/offline payment submission (§12). Method "online" is deliberately
 * NOT submittable here — online payments exist only through the gateway
 * checkout + verified webhook path, so a client can never self-declare an
 * online payment. Proof is metadata only (storage is not configured, §34).
 */
export const manualPaymentSchema = z.object({
  invoiceId: objectId,
  amount: money,
  method: z.enum(["manual", "cash", "bank-transfer"]),
  reference: z.string().trim().max(200).optional(),
  proofFileName: z.string().trim().max(300).optional(),
  proofUrl: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3, "A rejection reason is required").max(1000),
});

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3, "A reversal reason is required").max(1000),
});

export const checkoutSchema = z.object({
  invoiceId: objectId,
});
