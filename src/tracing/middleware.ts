import type { Request, Response, NextFunction } from "express";
import { context, propagation } from "@opentelemetry/api";

/**
 * Express middleware that extracts distributed tracing headers from incoming requests
 * and propagates them into the OpenTelemetry context.
 *
 * Supports:
 *   - X-Amzn-Trace-Id (AWS X-Ray format)
 *   - traceparent (W3C Trace Context)
 *   - tracestate
 *   - baggage
 */
export function tracingMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const carrier: Record<string, string> = {};

  const traceparent = req.headers["traceparent"];
  if (typeof traceparent === "string") carrier["traceparent"] = traceparent;

  const tracestate = req.headers["tracestate"];
  if (typeof tracestate === "string") carrier["tracestate"] = tracestate;

  const baggage = req.headers["baggage"];
  if (typeof baggage === "string") carrier["baggage"] = baggage;

  const xrayTraceId = req.headers["x-amzn-trace-id"];
  if (typeof xrayTraceId === "string") {
    (req as any).xrayTraceId = xrayTraceId;
  }

  const extractedContext = propagation.extract(context.active(), carrier);
  context.with(extractedContext, () => {
    next();
  });
}
