import { MemorySaver } from "@langchain/langgraph";

/**
 * Short-term memory: persists conversation state (message history, graph execution state)
 * per thread_id within a session.
 *
 * Uses LangGraph's built-in MemorySaver (in-memory). In production on AgentCore,
 * replace with AgentCoreMemorySaver which persists to the AgentCore Memory service:
 *
 *   import { AgentCoreMemorySaver } from "langgraph-checkpoint-aws";
 *   const checkpointer = new AgentCoreMemorySaver(MEMORY_ID, { regionName: REGION });
 */
export function createCheckpointer(): MemorySaver {
  return new MemorySaver();
}
