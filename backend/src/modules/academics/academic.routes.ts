import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import {
  classCreateSchema, classUpdateSchema, classroomCreateSchema, classroomUpdateSchema,
  gradingScaleCreateSchema, gradingScaleUpdateSchema, sectionCreateSchema, sectionUpdateSchema,
  sessionCreateSchema, sessionUpdateSchema, subjectCreateSchema, subjectUpdateSchema,
  teacherAssignmentCreateSchema,
} from "./academic.validation";
import * as svc from "./academic.service";

/**
 * Academic Management (§17) under /api/v1/academics.
 * Reads: admin/principal full; teacher/student/parent may read reference data
 * (their own views are scoped further by the portals in Phases 5/6).
 * Writes: Admin only (Principal approval of timetable etc. is a later phase).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const READ = ["admin", "principal", "teacher", "student", "parent"] as const;

/* Phase 5 — the signed-in teacher's own assignments (My Classes view) */
r.get("/my-assignments", authenticate, authorize("teacher"), requireDb, wrap(async (req, res) => { const out = await svc.listMyTeacherAssignments(req.user!.id); res.json({ success: true, data: { profile: out.profile, assignments: out.items } }); }));

/* Sessions */
r.post("/sessions", authenticate, authorize("admin"), validate(sessionCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { session: await svc.createSession(req.body) } }); }));
r.get("/sessions", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listSessions(req.query as Record<string, unknown>); res.json({ success: true, data: { sessions: out.items }, meta: out.meta }); }));
r.get("/sessions/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { session: await svc.getSession(req.params.id) } }); }));
r.patch("/sessions/:id", authenticate, authorize("admin"), validate(sessionUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { session: await svc.updateSession(req.params.id, req.body) } }); }));
r.delete("/sessions/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteSession(req.params.id) }); }));

/* Classes */
r.post("/classes", authenticate, authorize("admin"), validate(classCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { class: await svc.createClass(req.body) } }); }));
r.get("/classes", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listClasses(req.query as Record<string, unknown>); res.json({ success: true, data: { classes: out.items }, meta: out.meta }); }));
r.get("/classes/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { class: await svc.getClass(req.params.id) } }); }));
r.patch("/classes/:id", authenticate, authorize("admin"), validate(classUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { class: await svc.updateClass(req.params.id, req.body) } }); }));
r.delete("/classes/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteClass(req.params.id) }); }));

/* Sections */
r.post("/sections", authenticate, authorize("admin"), validate(sectionCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { section: await svc.createSection(req.body) } }); }));
r.get("/sections", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listSections(req.query as Record<string, unknown>); res.json({ success: true, data: { sections: out.items }, meta: out.meta }); }));
r.get("/sections/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { section: await svc.getSection(req.params.id) } }); }));
r.patch("/sections/:id", authenticate, authorize("admin"), validate(sectionUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { section: await svc.updateSection(req.params.id, req.body) } }); }));
r.delete("/sections/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteSection(req.params.id) }); }));

/* Subjects */
r.post("/subjects", authenticate, authorize("admin"), validate(subjectCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { subject: await svc.createSubject(req.body) } }); }));
r.get("/subjects", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listSubjects(req.query as Record<string, unknown>); res.json({ success: true, data: { subjects: out.items }, meta: out.meta }); }));
r.get("/subjects/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { subject: await svc.getSubject(req.params.id) } }); }));
r.patch("/subjects/:id", authenticate, authorize("admin"), validate(subjectUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { subject: await svc.updateSubject(req.params.id, req.body) } }); }));
r.delete("/subjects/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteSubject(req.params.id) }); }));

/* Classrooms */
r.post("/classrooms", authenticate, authorize("admin"), validate(classroomCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { classroom: await svc.createClassroom(req.body) } }); }));
r.get("/classrooms", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listClassrooms(req.query as Record<string, unknown>); res.json({ success: true, data: { classrooms: out.items }, meta: out.meta }); }));
r.get("/classrooms/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { classroom: await svc.getClassroom(req.params.id) } }); }));
r.patch("/classrooms/:id", authenticate, authorize("admin"), validate(classroomUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { classroom: await svc.updateClassroom(req.params.id, req.body) } }); }));
r.delete("/classrooms/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteClassroom(req.params.id) }); }));

/* Teacher assignments */
r.post("/teacher-assignments", authenticate, authorize("admin"), validate(teacherAssignmentCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { assignment: await svc.createTeacherAssignment(req.body) } }); }));
r.get("/teacher-assignments", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => { const out = await svc.listTeacherAssignments(req.query as Record<string, unknown>); res.json({ success: true, data: { assignments: out.items }, meta: out.meta }); }));
r.delete("/teacher-assignments/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteTeacherAssignment(req.params.id) }); }));

/* Grading scales */
r.post("/grading-scales", authenticate, authorize("admin"), validate(gradingScaleCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { gradingScale: await svc.createGradingScale(req.body) } }); }));
r.get("/grading-scales", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listGradingScales(req.query as Record<string, unknown>); res.json({ success: true, data: { gradingScales: out.items }, meta: out.meta }); }));
r.get("/grading-scales/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { gradingScale: await svc.getGradingScale(req.params.id) } }); }));
r.patch("/grading-scales/:id", authenticate, authorize("admin"), validate(gradingScaleUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { gradingScale: await svc.updateGradingScale(req.params.id, req.body) } }); }));
r.delete("/grading-scales/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.deleteGradingScale(req.params.id) }); }));

export default r;
