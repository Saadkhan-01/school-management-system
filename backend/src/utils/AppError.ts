
export class AppError extends Error {
  statusCode: number; code: string; details?: unknown;
  constructor(statusCode: number, code: string, message: string, details?: unknown) { super(message); this.statusCode = statusCode; this.code = code; this.details = details; }
}
export const notImplemented = (feature: string) => new AppError(501, "NOT_IMPLEMENTED", `${feature} is not implemented yet. See docs/feature-tracker.md for its phase/status.`);
