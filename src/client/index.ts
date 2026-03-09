import * as readline from "readline";
import { randomUUID } from "crypto";
import { AgentCoreClient } from "./agentcore-client.js";
import type { InvocationResponse, TraceStep } from "../types.js";

// -- Parse CLI args --
const args = process.argv.slice(2);
const enableTrace = args.includes("--trace");
const abMode = args.includes("--ab");
const qualifierIdx = args.indexOf("--qualifier");
const qualifier = qualifierIdx !== -1 ? args[qualifierIdx + 1] : undefined;
const baseUrl = process.env.AGENTCORE_URL ?? "http://localhost:8080";

const client = new AgentCoreClient(baseUrl);
const sessionId = randomUUID();
const customerId = "CUST-100";

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          AWS AgentCore LangGraph POC - Client               ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  Session:   ${sessionId}    ║`);
console.log(`║  Customer:  ${customerId.padEnd(47)}║`);
console.log(`║  Trace:     ${(enableTrace ? "ON" : "OFF").padEnd(47)}║`);
console.log(`║  Qualifier: ${(qualifier ?? (abMode ? "A/B mode" : "default (v1)")).padEnd(47)}║`);
console.log(`║  Server:    ${baseUrl.padEnd(47)}║`);
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Commands: /quit, /session (new session), /metrics          ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printTrace(trace: TraceStep[]): void {
  console.log("\n  ┌─ Trace ─────────────────────────────────────────────");
  for (const step of trace) {
    const icon =
      step.step === "memory_retrieve" ? "🧠" :
      step.step === "llm_call" ? "🤖" :
      step.step === "tool_call" ? "🔧" :
      step.step === "memory_save" ? "💾" : "  ";
    console.log(`  │ ${icon} ${step.step.padEnd(18)} ${String(step.durationMs).padStart(6)}ms  ${JSON.stringify(step.data)}`);
  }
  console.log("  └────────────────────────────────────────────────────\n");
}

function printResponse(label: string, res: InvocationResponse): void {
  if (label) {
    console.log(`\n  [${label}]`);
  }
  console.log(`\n  Agent (${res.variant}): ${res.response}\n`);
  if (res.trace && res.trace.length > 0) {
    printTrace(res.trace);
  }
}

async function handlePrompt(prompt: string): Promise<void> {
  if (abMode) {
    console.log("  Sending to both variants...\n");

    const [resV1, resV2] = await Promise.all([
      client.invoke({
        runtimeSessionId: sessionId,
        payload: { prompt, customerId },
        qualifier: "v1",
        enableTrace,
      }),
      client.invoke({
        runtimeSessionId: `${sessionId}-v2`,
        payload: { prompt, customerId },
        qualifier: "v2",
        enableTrace,
      }),
    ]);

    printResponse("V1 - Concise", resV1);
    printResponse("V2 - Detailed", resV2);

    console.log("  ┌─ A/B Comparison ──────────────────────────────────");
    console.log("  │ V1: Claude Sonnet + Concise prompt");
    console.log("  │ V2: Claude Haiku  + Detailed prompt");
    console.log("  │");
    console.log(`  │ V1 response length: ${resV1.response.length} chars`);
    console.log(`  │ V2 response length: ${resV2.response.length} chars`);
    console.log("  └──────────────────────────────────────────────────\n");
  } else {
    const res = await client.invoke({
      runtimeSessionId: sessionId,
      payload: { prompt, customerId },
      qualifier,
      enableTrace,
    });
    printResponse("", res);
  }
}

function promptUser(): void {
  rl.question("You: ", async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      promptUser();
      return;
    }

    if (trimmed === "/quit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (trimmed === "/metrics") {
      try {
        const metrics = await client.getAbMetrics();
        console.log("\n  A/B Metrics:");
        console.log(JSON.stringify(metrics, null, 2));
        console.log();
      } catch (err) {
        console.error("  Error fetching metrics:", err);
      }
      promptUser();
      return;
    }

    if (trimmed === "/session") {
      console.log(`  New session started (previous: ${sessionId})`);
      promptUser();
      return;
    }

    try {
      await handlePrompt(trimmed);
    } catch (err) {
      console.error("  Error:", err);
    }

    promptUser();
  });
}

// Verify server is up, then start
async function main(): Promise<void> {
  try {
    const ping = await client.ping();
    console.log(`  Server status: ${ping.status}\n`);
  } catch {
    console.error(`  WARNING: Cannot reach server at ${baseUrl}. Make sure it's running.\n`);
  }
  promptUser();
}

main();
