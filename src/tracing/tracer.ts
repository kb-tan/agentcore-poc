import { trace, SpanStatusCode, context, type Span, type Tracer } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";

let initialized = false;

export function initTracer(): void {
  if (initialized) return;

  const enabled = process.env.AGENT_OBSERVABILITY_ENABLED === "true";
  if (!enabled) {
    console.log("[tracing] Observability disabled (set AGENT_OBSERVABILITY_ENABLED=true to enable)");
    initialized = true;
    return;
  }

  const provider = new NodeTracerProvider();

  // In local dev, export spans to console.
  // On AgentCore Runtime, ADOT auto-instrumentation replaces this with CloudWatch/X-Ray export.
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  provider.register();

  console.log("[tracing] OpenTelemetry tracer initialized (console exporter)");
  initialized = true;
}

export function getTracer(): Tracer {
  return trace.getTracer("agentcore-langgraph-poc", "1.0.0");
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
