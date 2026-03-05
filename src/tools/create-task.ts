/**
 * astro_create_task tool
 *
 * Creates a new plan node (task) in an Astro project by calling
 * POST /api/data/plan/nodes.
 *
 * Gateway method: astro.tasks.create
 */

import type { AstroClient } from '../client.js';
import type { OpenClawToolDefinition, OpenClawToolResult } from '../types.js';

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  estimate?: string;
  verification?: string;
}

interface CreateTaskResponse {
  ok: boolean;
  number: number | null;
}

export const createTaskToolDef: OpenClawToolDefinition = {
  name: 'astro_create_task',
  description:
    'Create a new task (plan node) in an Astro project. The task is added to the project\'s plan graph. ' +
    'Use astro_run_task to dispatch it for execution after creation.',
  inputSchema: {
    type: 'object',
    required: ['projectId', 'title'],
    properties: {
      projectId: {
        type: 'string',
        description: 'UUID of the project to add the task to.',
      },
      title: {
        type: 'string',
        description: 'Title of the task.',
      },
      description: {
        type: 'string',
        description: 'Detailed description or instructions for the task.',
      },
      status: {
        type: 'string',
        enum: ['planned', 'in_progress', 'completed', 'pruned'],
        description: 'Initial status of the task. Defaults to "planned".',
      },
      priority: {
        type: 'string',
        enum: ['urgent', 'high', 'medium', 'low', 'none'],
        description: 'Priority level of the task.',
      },
      estimate: {
        type: 'string',
        enum: ['XS', 'S', 'M', 'L', 'XL'],
        description: 'Size estimate for the task.',
      },
      verification: {
        type: 'string',
        enum: ['auto', 'human'],
        description: '"auto" — task auto-closes when tests pass. "human" — requires manual approval. Defaults to "auto".',
      },
    },
    additionalProperties: false,
  },
};

export async function createTask(
  client: AstroClient,
  input: CreateTaskInput,
): Promise<OpenClawToolResult> {
  if (!input.projectId?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: projectId is required and must be non-empty.' }],
      isError: true,
    };
  }
  if (!input.title?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: title is required and must be non-empty.' }],
      isError: true,
    };
  }

  const id = crypto.randomUUID();
  const body: Record<string, unknown> = {
    id,
    projectId: input.projectId,
    title: input.title,
    type: 'task',
  };
  if (input.description !== undefined) body['description'] = input.description;
  if (input.status !== undefined) body['status'] = input.status;
  if (input.priority !== undefined) body['priority'] = input.priority;
  if (input.estimate !== undefined) body['estimate'] = input.estimate;
  if (input.verification !== undefined) body['verification'] = input.verification;

  const result = await client.post<CreateTaskResponse>('/api/data/plan/nodes', body);

  const text = [
    `Task created successfully.`,
    `  Node ID     : ${id}`,
    `  Project ID  : ${input.projectId}`,
    `  Title       : ${input.title}`,
    result.number !== null ? `  Number      : #${result.number}` : '',
    '',
    `Use astro_run_task with nodeId="${id}" and projectId="${input.projectId}" to execute this task.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
    metadata: { nodeId: id, projectId: input.projectId, number: result.number },
  };
}
