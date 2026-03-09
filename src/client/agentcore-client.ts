import { randomUUID } from "crypto";
import type { InvocationRequest, InvocationResponse } from "../types.js";

/**
 * HTTP client that mirrors the @aws-sdk/client-bedrock-agentcore
 * InvokeAgentRuntimeCommand interface. In production, swap this
 * for the real AWS SDK client.
 */
export interface InvokeParams {
  agentRuntimeArn?: string;
  runtimeSessionId: string;
  payload: InvocationRequest;
  qualifier?: string;
  enableTrace?: boolean;
}

export class AgentCoreClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8080") {
    this.baseUrl = baseUrl;
  }

  async invoke(params: InvokeParams): Promise<InvocationResponse> {
    const traceId = this.generateXRayTraceId();
    const traceparent = this.generateTraceparent();

    const url = new URL("/invocations", this.baseUrl);
    if (params.qualifier) {
      url.searchParams.set("qualifier", params.qualifier);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": params.runtimeSessionId,
      "X-Amzn-Trace-Id": traceId,
      "traceparent": traceparent,
    };

    if (params.enableTrace) {
      headers["X-Enable-Trace"] = "true";
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(params.payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AgentCore invocation failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as InvocationResponse;
  }

  async ping(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/ping`);
    return (await response.json()) as { status: string };
  }

  async getAbMetrics(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ab/metrics`);
    return (await response.json()) as Record<string, unknown>;
  }

  private generateXRayTraceId(): string {
    const time = Math.floor(Date.now() / 1000).toString(16);
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return `Root=1-${time}-${id};Sampled=1`;
  }

  private generateTraceparent(): string {
    const traceId = randomUUID().replace(/-/g, "");
    const spanId = randomUUID().replace(/-/g, "").slice(0, 16);
    return `00-${traceId}-${spanId}-01`;
  }
}
