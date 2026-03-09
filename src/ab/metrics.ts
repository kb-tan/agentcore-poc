import type { VariantMetrics } from "../types.js";

const metricsStore: Record<string, VariantMetrics> = {};

function ensureVariant(variantId: string): VariantMetrics {
  if (!metricsStore[variantId]) {
    metricsStore[variantId] = {
      variantId,
      totalRequests: 0,
      avgLatencyMs: 0,
      totalToolCalls: 0,
      avgResponseLength: 0,
      latencies: [],
      responseLengths: [],
    };
  }
  return metricsStore[variantId];
}

export function recordRequest(
  variantId: string,
  latencyMs: number,
  toolCalls: number,
  responseLength: number
): void {
  const m = ensureVariant(variantId);
  m.totalRequests++;
  m.totalToolCalls += toolCalls;
  m.latencies.push(latencyMs);
  m.responseLengths.push(responseLength);
  m.avgLatencyMs = Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length);
  m.avgResponseLength = Math.round(m.responseLengths.reduce((a, b) => a + b, 0) / m.responseLengths.length);
}

export function getMetrics(): Record<string, Omit<VariantMetrics, "latencies" | "responseLengths">> {
  const result: Record<string, Omit<VariantMetrics, "latencies" | "responseLengths">> = {};
  for (const [id, m] of Object.entries(metricsStore)) {
    const { latencies, responseLengths, ...rest } = m;
    result[id] = rest;
  }
  return result;
}
