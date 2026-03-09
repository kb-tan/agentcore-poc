import express from "express";
import { HumanMessage } from "@langchain/core/messages";

import type { InvocationRequest, InvocationResponse, PingResponse } from "./types.js";
import { VARIANTS, getVariant } from "./ab/variants.js";
import { recordRequest, getMetrics } from "./ab/metrics.js";
import { createAgentGraph } from "./graph.js";
import { TraceCollector } from "./tracing/collector.js";
import { initTracer } from "./tracing/tracer.js";
import { tracingMiddleware } from "./tracing/middleware.js";

initTracer();

// Pre-compile agent graphs for each variant
const agentGraphs: Record<string, ReturnType<typeof createAgentGraph>> = {};
for (const [id, variant] of Object.entries(VARIANTS)) {
  agentGraphs[id] = createAgentGraph(variant);
  console.log(`[server] Compiled agent graph for variant: ${id} (${variant.name})`);
}

const app = express();
app.use(express.json());
app.use(tracingMiddleware);

// -- GET /ping (AgentCore health check) --
app.get("/ping", (_req, res) => {
  const response: PingResponse = {
    status: "Healthy",
    time_of_last_update: Math.floor(Date.now() / 1000),
  };
  res.json(response);
});

// -- POST /invocations (AgentCore primary endpoint) --
app.post("/invocations", async (req, res) => {
  const requestStart = performance.now();

  try {
    const qualifier = (req.query.qualifier as string) || undefined;
    const variant = getVariant(qualifier);
    const graph = agentGraphs[variant.id];

    const sessionId =
      (req.headers["x-amzn-bedrock-agentcore-runtime-session-id"] as string) ||
      `session-${Date.now()}`;

    const enableTrace = req.headers["x-enable-trace"] === "true";
    const traceCollector = new TraceCollector(enableTrace);

    const body = req.body as InvocationRequest;
    const prompt = body.prompt ?? "Hello!";
    const actorId = body.customerId ?? "default";

    console.log(`[server] Session=${sessionId} Variant=${variant.id} Prompt="${prompt.slice(0, 80)}"`);

    const result = await graph.invoke(
      {
        messages: [new HumanMessage(prompt)],
        actorId,
        sessionId,
      },
      {
        configurable: {
          thread_id: sessionId,
          variant,
          traceCollector,
        },
      }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const responseText = typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    const latencyMs = Math.round(performance.now() - requestStart);

    // Count tool calls from the conversation
    const toolCallCount = result.messages.filter(
      (m: any) => m._getType() === "tool"
    ).length;

    recordRequest(variant.id, latencyMs, toolCallCount, responseText.length);

    const response: InvocationResponse = {
      response: responseText,
      sessionId,
      variant: variant.id,
      trace: traceCollector.getSteps(),
    };

    res.json(response);
  } catch (err) {
    console.error("[server] Invocation error:", err);
    res.status(500).json({
      response: "An error occurred processing your request.",
      error: String(err),
    });
  }
});

// -- GET /ab/metrics (A/B testing comparison) --
app.get("/ab/metrics", (_req, res) => {
  res.json(getMetrics());
});

// -- Start server --
const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] AgentCore Runtime listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Endpoints:`);
  console.log(`  POST /invocations?qualifier=v1|v2  - Agent invocation`);
  console.log(`  GET  /ping                         - Health check`);
  console.log(`  GET  /ab/metrics                   - A/B test metrics`);
});
