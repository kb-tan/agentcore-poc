import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

// -- AgentCore HTTP contract types --

export interface InvocationRequest {
  prompt: string;
  customerId?: string;
}

export interface TraceStep {
  step: string;
  durationMs: number;
  data: Record<string, unknown>;
}

export interface InvocationResponse {
  response: string;
  sessionId: string;
  variant?: string;
  trace?: TraceStep[];
}

export interface PingResponse {
  status: "Healthy" | "HealthyBusy";
  time_of_last_update: number;
}

// -- LangGraph state --

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  longTermMemories: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  actorId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  sessionId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

export type AgentStateType = typeof AgentState.State;

// -- A/B variant config --

export interface VariantConfig {
  id: string;
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
}

// -- A/B metrics --

export interface VariantMetrics {
  variantId: string;
  totalRequests: number;
  avgLatencyMs: number;
  totalToolCalls: number;
  avgResponseLength: number;
  latencies: number[];
  responseLengths: number[];
}
