/**
 * astro_create_project tool
 *
 * Creates a new Astro project by calling POST /api/data/projects.
 *
 * Gateway method: astro.projects.create
 */

import type { AstroClient } from '../client.js';
import type { OpenClawToolDefinition, OpenClawToolResult } from '../types.js';

export interface CreateProjectInput {
  name: string;
  description?: string;
  repository?: string;
  visionDoc?: string;
}

interface CreateProjectResponse {
  id: string;
  name: string;
  number: number | null;
  [key: string]: unknown;
}

export const createProjectToolDef: OpenClawToolDefinition = {
  name: 'astro_create_project',
  description:
    'Create a new Astro project. Returns the project ID which can be used with astro_get_plan, astro_create_task, and astro_run_task.',
  inputSchema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'Name of the project.',
      },
      description: {
        type: 'string',
        description: 'Short description of the project.',
      },
      repository: {
        type: 'string',
        description: 'Git repository URL (e.g. https://github.com/org/repo).',
      },
      visionDoc: {
        type: 'string',
        description: 'Vision document content injected into every agent session for this project.',
      },
    },
    additionalProperties: false,
  },
};

export async function createProject(
  client: AstroClient,
  input: CreateProjectInput,
): Promise<OpenClawToolResult> {
  if (!input.name?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: name is required and must be non-empty.' }],
      isError: true,
    };
  }

  const body: Record<string, unknown> = { name: input.name };
  if (input.description !== undefined) body['description'] = input.description;
  if (input.repository !== undefined) body['repository'] = input.repository;
  if (input.visionDoc !== undefined) body['visionDoc'] = input.visionDoc;

  const result = await client.post<CreateProjectResponse>('/api/data/projects', body);

  const text = [
    `Project created successfully.`,
    `  ID          : ${result.id}`,
    `  Name        : ${result.name}`,
    result.number !== null ? `  Number      : #${result.number}` : '',
    '',
    `Use astro_create_task with projectId="${result.id}" to add tasks to this project.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
    metadata: { projectId: result.id, name: result.name, number: result.number },
  };
}
