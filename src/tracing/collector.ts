import type { TraceStep } from "../types.js";

/**
 * Per-request trace collector. Collects trace steps during graph execution
 * and returns them in the JSON response when X-Enable-Trace: true.
 */
export class TraceCollector {
  private steps: TraceStep[] = [];
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  addStep(step: string, durationMs: number, data: Record<string, unknown>): void {
    if (!this.enabled) return;
    this.steps.push({ step, durationMs, data });
  }

  startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }

  getSteps(): TraceStep[] | undefined {
    return this.enabled ? this.steps : undefined;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
