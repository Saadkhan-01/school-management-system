import { Student } from "../modules/students/student.model";

/**
 * Admission number format: ADM-<year>-<4-digit sequence>, e.g. ADM-2026-0007.
 * The sequence is per calendar year of enrollment. Collision safety: the caller
 * creates the Student inside a retry loop — the unique index on
 * students.admissionNumber is the real guard; on a duplicate-key error the
 * sequence is recomputed (count may have moved) and creation is retried.
 */
export function admissionNumberPrefix(year = new Date().getFullYear()): string {
  return `ADM-${year}-`;
}

export async function nextAdmissionNumber(year = new Date().getFullYear()): Promise<string> {
  const prefix = admissionNumberPrefix(year);
  const count = await Student.countDocuments({ admissionNumber: { $regex: `^${prefix}` } });
  // Also consider the highest existing sequence in case records were imported out of order.
  const last = await Student.findOne({ admissionNumber: { $regex: `^${prefix}` } }).sort({ admissionNumber: -1 }).select("admissionNumber").lean();
  let seq = count + 1;
  if (last) {
    const lastSeq = Number.parseInt(last.admissionNumber.slice(prefix.length), 10);
    if (Number.isFinite(lastSeq) && lastSeq >= seq) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
