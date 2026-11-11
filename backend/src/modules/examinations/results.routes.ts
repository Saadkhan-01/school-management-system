import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import * as svc from "./exam.service";
import { renderReportCardPdf } from "./reportCardPdf";

/**
 * Results & report cards (§19) under /api/v1/results.
 * The visibility rule lives in the service: students/parents get
 * 404 RESULT_NOT_PUBLISHED until results are published, and scope
 * (own record / verified link / assigned classes) is always checked.
 * The PDF endpoint applies exactly the same checks, then streams a real
 * pdfkit-generated report card.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const READ = ["admin", "principal", "teacher", "student", "parent"] as const;

r.get("/report-card/:examId/:studentId", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { reportCard: await svc.computeReportCard(actor(req), req.params.examId, req.params.studentId) } });
}));
r.get("/report-card/:examId/:studentId/pdf", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const card = await svc.computeReportCard(actor(req), req.params.examId, req.params.studentId);
  const doc = renderReportCardPdf(card);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-card-${req.params.studentId}.pdf"`);
  doc.pipe(res);
}));
r.get("/exam/:examId/summary", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { summary: await svc.classResultSummary(actor(req), req.params.examId) } });
}));

export default r;
