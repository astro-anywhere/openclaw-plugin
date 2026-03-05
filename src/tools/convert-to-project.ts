/**
 * astro_convert_to_project tool
 *
 * Converts a plan node (task) into a standalone Astro project.
 *
 * Steps:
 *   1. Fetch the source task's details and its parent project metadata
 *   2. Build an enriched description from the task's title, description,
 *      content, acceptance criteria, and execution output
 *   3. Create a new project inheriting the source project's repo/settings
 *   4. Optionally delete the source task from the original project
 *
 * This mirrors the "Convert to Project" action in the Astro UI.
 *
 * Gateway method: astro.tasks.convertToProject
 */

import type { AstroClient } from '../client.js';
import type { OpenClawToolDefinition, OpenClawToolResult } from '../types.js';

export interface ConvertToProjectInput {
  nodeId: string;
  projectId: string;
  newProjectName?: string;
  deleteSourceNode?: boolean;
}

interface PlanNode {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  status: string;
  executionOutput: string | null;
  executionError: string | null;
  acceptanceCriteria: Array<{ type: string; description: string; command?: string }> | null;
  [key: string]: unknown;
}

interface ProjectInfo {
  id: string;
  name: string;
  visionDoc: string | null;
  workingDirectory: string | null;
  repository: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  deliveryMode: string | null;
  defaultMachineId: string | null;
  [key: string]: unknown;
}

export const convertToProjectToolDef: OpenClawToolDefinition = {
  name: 'astro_convert_to_project',
  description:
    'Convert a plan task into a standalone Astro project. ' +
    'The new project inherits the source project\'s repository, vision doc, and machine settings. ' +
    'The task\'s title, description, content, acceptance criteria, and execution output ' +
    'are combined into an enriched project description for plan generation.',
  inputSchema: {
    type: 'object',
    required: ['nodeId', 'projectId'],
    properties: {
      nodeId: {
        type: 'string',
        description: 'UUID of the plan node (task) to convert.',
      },
      projectId: {
        type: 'string',
        description: 'UUID of the project the task belongs to.',
      },
      newProjectName: {
        type: 'string',
        description: 'Name for the new project. Defaults to the task\'s title.',
      },
      deleteSourceNode: {
        type: 'boolean',
        description: 'Whether to delete the source task from the original project after conversion. Defaults to false.',
      },
    },
    additionalProperties: false,
  },
};

/**
 * Strip HTML tags and decode common entities (for TipTap rich text content).
 */
function stripHtml(html: string): string {
  let text = html.replace(/<[^>]*>/g, ' ');
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&apos;': "'",
  };
  for (const [entity, char] of Object.entries(entities)) {
    text = text.replaceAll(entity, char);
  }
  text = text.replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Build enriched project description from node context.
 */
function buildEnrichedDescription(node: PlanNode): string {
  const parts: string[] = [];

  parts.push(`# ${node.title}`);

  if (node.description) {
    parts.push(`\n## Description\n${node.description}`);
  }

  if (node.content) {
    const plain = stripHtml(node.content);
    if (plain) {
      parts.push(`\n## Detailed Content\n${plain}`);
    }
  }

  if (node.acceptanceCriteria?.length) {
    const criteria = node.acceptanceCriteria
      .map((c) => `- [${c.type}] ${c.description}${c.command ? ` (command: ${c.command})` : ''}`)
      .join('\n');
    parts.push(`\n## Acceptance Criteria\n${criteria}`);
  }

  if (node.executionOutput) {
    const truncated = node.executionOutput.length > 4000
      ? `${node.executionOutput.slice(0, 2000)}\n\n... [truncated] ...\n\n${node.executionOutput.slice(-2000)}`
      : node.executionOutput;
    parts.push(`\n## Previous Execution Output\n${truncated}`);
  }

  if (node.executionError) {
    const truncated = node.executionError.length > 4000
      ? `${node.executionError.slice(0, 2000)}\n\n... [truncated] ...\n\n${node.executionError.slice(-2000)}`
      : node.executionError;
    parts.push(`\n## Previous Execution Error\n${truncated}`);
  }

  return parts.join('\n');
}

export async function convertToProject(
  client: AstroClient,
  input: ConvertToProjectInput,
): Promise<OpenClawToolResult> {
  if (!input.nodeId?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: nodeId is required and must be non-empty.' }],
      isError: true,
    };
  }
  if (!input.projectId?.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: projectId is required and must be non-empty.' }],
      isError: true,
    };
  }

  // 1. Fetch source project and its plan to find the node
  const [projectsResponse, planResponse] = await Promise.all([
    client.get<ProjectInfo[]>('/api/data/projects'),
    client.get<{ nodes: PlanNode[]; edges: unknown[] }>(
      `/api/data/plan/${encodeURIComponent(input.projectId)}`,
    ),
  ]);

  const sourceProject = projectsResponse.find((p) => p.id === input.projectId);
  if (!sourceProject) {
    return {
      content: [{ type: 'text', text: `Error: Project ${input.projectId} not found.` }],
      isError: true,
    };
  }

  const sourceNode = planResponse.nodes.find((n) => n.id === input.nodeId);
  if (!sourceNode) {
    return {
      content: [{ type: 'text', text: `Error: Node ${input.nodeId} not found in project ${input.projectId}.` }],
      isError: true,
    };
  }

  // 2. Build enriched description
  const enrichedDescription = buildEnrichedDescription(sourceNode);
  const projectName = input.newProjectName?.trim() || sourceNode.title;

  // 3. Create new project inheriting source settings
  const newProjectBody: Record<string, unknown> = {
    name: projectName,
    description: enrichedDescription,
    visionDoc: sourceProject.visionDoc || '',
    workingDirectory: sourceProject.workingDirectory,
    repository: sourceProject.repository,
    githubOwner: sourceProject.githubOwner,
    githubRepo: sourceProject.githubRepo,
    deliveryMode: sourceProject.deliveryMode,
    defaultMachineId: sourceProject.defaultMachineId,
    projectType: 'plan',
  };

  const newProject = await client.post<{ id: string; name: string; number: number | null }>(
    '/api/data/projects',
    newProjectBody,
  );

  // 4. Optionally delete source node
  if (input.deleteSourceNode) {
    try {
      await client.request('PATCH', `/api/data/plan/nodes/${encodeURIComponent(input.nodeId)}`, {
        status: 'pruned',
      });
    } catch {
      // Non-critical — project was created, just couldn't prune the source node
    }
  }

  const lines = [
    `Task converted to project successfully.`,
    '',
    `Source task: "${sourceNode.title}" (${input.nodeId})`,
    `New project: "${projectName}" (${newProject.id})`,
    newProject.number !== null ? `Project #${newProject.number}` : '',
    '',
    `Inherited from source project:`,
    sourceProject.repository ? `  Repository   : ${sourceProject.repository}` : '',
    sourceProject.visionDoc ? `  Vision doc   : (inherited)` : '',
    sourceProject.defaultMachineId ? `  Machine      : ${sourceProject.defaultMachineId}` : '',
    '',
    `The new project has an enriched description built from the task's title, description,`,
    `content, acceptance criteria, and execution output.`,
    '',
    `Next steps:`,
    `  - Open the project in the Astro UI to generate a plan`,
    `  - Or use astro_create_task to manually add tasks to the new project`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text: lines }],
    metadata: {
      newProjectId: newProject.id,
      newProjectName: projectName,
      sourceNodeId: input.nodeId,
      sourceProjectId: input.projectId,
    },
  };
}
