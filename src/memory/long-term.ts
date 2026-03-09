import { InMemoryStore } from "@langchain/langgraph";

/**
 * Long-term memory: stores user preferences and facts across sessions.
 *
 * Uses LangGraph's InMemoryStore. In production on AgentCore, replace with
 * AgentCoreMemoryStore which persists to the AgentCore Memory service and
 * provides intelligent retrieval (summaries, preferences extraction).
 *
 *   import { AgentCoreMemoryStore } from "langgraph-checkpoint-aws";
 *   const store = new AgentCoreMemoryStore(MEMORY_ID, { regionName: REGION });
 */

const store = new InMemoryStore();

export function getLongTermStore(): InMemoryStore {
  return store;
}

export async function retrieveMemories(actorId: string): Promise<string[]> {
  const namespace = ["preferences", actorId];
  const items = await store.search(namespace);
  return items.map((item) => {
    const val = item.value as Record<string, string>;
    return val.content ?? JSON.stringify(val);
  });
}

export async function saveMemory(actorId: string, content: string): Promise<void> {
  const namespace = ["preferences", actorId];
  const key = `mem_${Date.now()}`;
  await store.put(namespace, key, { content, savedAt: new Date().toISOString() });
}
