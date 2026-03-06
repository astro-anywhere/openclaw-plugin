/**
 * astro_task_status tool
 *
 * Returns the current execution status and output for a dispatched task by calling
 * GET /api/data/executions on the Astro backend and finding the matching execution.
 *
 * Gateway method: astro.dispatch.taskStatus
 */

import type { AstroClient } from '../client.js';
import type { OpenClawToolDefinition, OpenClawToolResult } from '../types.js';

// ── API response shape ────────────────────────────────────────────────────────

/** Shape returned by the GET /api/data/executions endpoint (per entry). */
interface ExecutionEntry {
  executionId: string;
  nodeId: string;
  projectId: string;
  status: string;
  streamText: string | null;
  error: string | null;
  machineId: string | null;
  sessionId: string | null;
  providerId: string | null;
  providerName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

/** Public type exposed to consumers of this tool. */
export interface TaskExecution {
  id: string;
  nodeId: string;
  projectId: string;
  status: string;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  providerId: string | null;
  providerName: string | null;
  durationMs: number | null;
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const taskStatusToolDef: OpenClawToolDefinition = {
  name: 'astro_task_status',
  description:
    'Get the current execution status and output for a dispatched Astro task. ' +
    'Poll this tool after calling astro_run_task to track progress. ' +
    'When status is "completed" or "auto_verified", the output field contains the result. ' +
    'When status is "error", the error field describes what went wrong.',
  inputSchema: {
    type: 'object',
    required: ['executionId'],
    properties: {
      executionId: {
        type: 'string',
        description:
          'The executionId returned by astro_run_task, or the executionId stored on the plan node.',
      },
    },
    additionalProperties: false,
  },
};

// ── Status display helpers ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned (not yet started)',
  dispatched: 'Dispatched (waiting for agent runner)',
  in_progress: 'In Progress',
  auto_verified: 'Completed — auto-verified',
  awaiting_approval: 'Awaiting Approval',
  awaiting_judgment: 'Awaiting Human Judgment',
  completed: 'Completed',
  pruned: 'Pruned (cancelled)',
  error: 'Error',
};

function humanStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

// ── Tool handler ──────────────────────────────────────────────────────────────

export async function taskStatus(
  client: AstroClient,
  input: { executionId: string },
): Promise<OpenClawToolResult> {
  if (!input.executionId?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: executionId is required and must be non-empty.' }],
      isError: true,
    };
  }

  // GET /api/data/executions returns a map keyed by nodeId
  const allExecutions = await client.get<Record<string, ExecutionEntry>>('/api/data/executions');

  // Find the entry matching the requested executionId
  const entry = Object.values(allExecutions).find(
    (e) => e.executionId === input.executionId,
  );

  if (!entry) {
    return {
      content: [{ type: 'text', text: `Execution "${input.executionId}" not found.` }],
      isError: true,
    };
  }

  const execution: TaskExecution = {
    id: entry.executionId,
    nodeId: entry.nodeId,
    projectId: entry.projectId,
    status: entry.status,
    output: entry.streamText,
    error: entry.error,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    providerId: entry.providerId,
    providerName: entry.providerName,
    durationMs: entry.durationMs,
  };

  const lines: string[] = [
    `Execution: ${execution.id}`,
    `  Node ID    : ${execution.nodeId}`,
    `  Project ID : ${execution.projectId}`,
    `  Status     : ${humanStatus(execution.status)}`,
  ];

  if (execution.startedAt) {
    lines.push(`  Started    : ${execution.startedAt}`);
  }
  if (execution.completedAt) {
    lines.push(`  Completed  : ${execution.completedAt}`);
  }

  if (execution.providerName) {
    lines.push(`  Provider   : ${execution.providerName}`);
  }
  if (execution.durationMs !== null) {
    lines.push(`  Duration   : ${(execution.durationMs / 1000).toFixed(1)}s`);
  }

  const isTerminal = ['auto_verified', 'completed', 'pruned', 'error'].includes(execution.status);

  if (execution.output) {
    lines.push('', 'Output:', execution.output);
  }

  if (execution.error) {
    lines.push('', 'Error:', execution.error);
  }

  if (!isTerminal) {
    lines.push('', `Task is still running. Poll again to check for updates.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    metadata: {
      execution,
      isTerminal,
      isSuccess: ['auto_verified', 'completed'].includes(execution.status),
    },
  };
}
