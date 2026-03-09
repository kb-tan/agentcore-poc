import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatBedrockConverse } from "@langchain/aws";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import { AgentState, type AgentStateType, type VariantConfig } from "./types.js";
import { orderLookupTool } from "./tools/order-lookup.js";
import { faqSearchTool } from "./tools/faq-search.js";
import { accountInfoTool } from "./tools/account-info.js";
import { retrieveMemories, saveMemory } from "./memory/long-term.js";
import { createCheckpointer } from "./memory/short-term.js";
import { TraceCollector } from "./tracing/collector.js";
import { withSpan } from "./tracing/tracer.js";

const tools = [orderLookupTool, faqSearchTool, accountInfoTool];

const toolNode = new ToolNode(tools);

function createModel(variant: VariantConfig) {
  return new ChatBedrockConverse({
    model: variant.modelId,
    region: process.env.AWS_REGION ?? "us-west-2",
    temperature: variant.temperature,
  }).bindTools(tools);
}

// -- Graph nodes --

async function retrieveMemoryNode(
  state: AgentStateType,
  config?: RunnableConfig
): Promise<Partial<AgentStateType>> {
  const collector: TraceCollector | undefined = (config?.configurable as any)?.traceCollector;
  const elapsed = collector?.startTimer();

  return withSpan("retrieveMemory", async (span) => {
    const actorId = state.actorId || "default";
    const memories = await retrieveMemories(actorId);

    span.setAttribute("memory.count", memories.length);
    span.setAttribute("actor.id", actorId);

    const memoryText = memories.length > 0
      ? `\n\nKnown facts about this customer from previous conversations:\n${memories.map((m) => `- ${m}`).join("\n")}`
      : "";

    if (elapsed && collector) {
      collector.addStep("memory_retrieve", elapsed(), {
        actorId,
        memoriesFound: memories.length,
      });
    }

    return { longTermMemories: memoryText };
  });
}

async function agentNode(
  state: AgentStateType,
  config?: RunnableConfig
): Promise<Partial<AgentStateType>> {
  const variant: VariantConfig = (config?.configurable as any)?.variant;
  const collector: TraceCollector | undefined = (config?.configurable as any)?.traceCollector;
  const elapsed = collector?.startTimer();

  return withSpan("agent", async (span) => {
    const model = createModel(variant);

    const systemContent = variant.systemPrompt + (state.longTermMemories || "");
    const systemMsg = new SystemMessage(systemContent);

    const response = await model.invoke([systemMsg, ...state.messages]);

    span.setAttribute("variant.id", variant.id);
    span.setAttribute("model", variant.modelId);

    if (elapsed && collector) {
      const aiMsg = response as AIMessage;
      const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;
      collector.addStep("llm_call", elapsed(), {
        model: variant.modelId,
        variant: variant.id,
        hasToolCalls: !!hasToolCalls,
        toolCallCount: aiMsg.tool_calls?.length ?? 0,
      });
    }

    return { messages: [response] };
  });
}

async function toolNodeWrapper(
  state: AgentStateType,
  config?: RunnableConfig
): Promise<Partial<AgentStateType>> {
  const collector: TraceCollector | undefined = (config?.configurable as any)?.traceCollector;
  const elapsed = collector?.startTimer();

  return withSpan("tools", async (span) => {
    const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMsg.tool_calls ?? [];

    span.setAttribute("tool.count", toolCalls.length);
    toolCalls.forEach((tc, i) => {
      span.setAttribute(`tool.${i}.name`, tc.name);
    });

    const result = await toolNode.invoke(state, config);

    if (elapsed && collector) {
      collector.addStep("tool_call", elapsed(), {
        tools: toolCalls.map((tc) => tc.name),
        count: toolCalls.length,
      });
    }

    return result as Partial<AgentStateType>;
  });
}

async function saveMemoryNode(
  state: AgentStateType,
  config?: RunnableConfig
): Promise<Partial<AgentStateType>> {
  const collector: TraceCollector | undefined = (config?.configurable as any)?.traceCollector;
  const elapsed = collector?.startTimer();

  return withSpan("saveMemory", async (span) => {
    const actorId = state.actorId || "default";

    // Extract preferences/facts from the last human message
    const humanMessages = state.messages.filter((m) => m._getType() === "human");
    const lastHuman = humanMessages[humanMessages.length - 1];

    if (lastHuman) {
      const content = typeof lastHuman.content === "string" ? lastHuman.content : "";
      const prefKeywords = ["prefer", "like", "favorite", "always", "never", "love", "hate", "want"];
      const hasPref = prefKeywords.some((kw) => content.toLowerCase().includes(kw));

      if (hasPref) {
        await saveMemory(actorId, content);
        span.setAttribute("memory.saved", true);
      }
    }

    if (elapsed && collector) {
      collector.addStep("memory_save", elapsed(), { actorId, saved: true });
    }

    return {};
  });
}

// -- Routing --

function shouldUseTool(state: AgentStateType): "tools" | "saveMemory" {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg._getType() === "ai") {
    const aiMsg = lastMsg as AIMessage;
    if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
      return "tools";
    }
  }
  return "saveMemory";
}

// -- Graph factory --

export function createAgentGraph(variant: VariantConfig) {
  const checkpointer = createCheckpointer();

  const graph = new StateGraph(AgentState)
    .addNode("retrieveMemory", retrieveMemoryNode)
    .addNode("agent", agentNode)
    .addNode("tools", toolNodeWrapper)
    .addNode("saveMemory", saveMemoryNode)
    .addEdge(START, "retrieveMemory")
    .addEdge("retrieveMemory", "agent")
    .addConditionalEdges("agent", shouldUseTool, {
      tools: "tools",
      saveMemory: "saveMemory",
    })
    .addEdge("tools", "agent")
    .addEdge("saveMemory", END);

  return graph.compile({ checkpointer });
}
