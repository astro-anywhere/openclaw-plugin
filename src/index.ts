/**
 * @astroanywhere/astro — OpenClaw Gateway Plugin
 *
 * Registers Astro's project/plan/task management as OpenClaw gateway tools:
 *
 *   astro_list_projects  → List all projects
 *   astro_get_plan       → Get plan graph for a project
 *   astro_run_task       → Dispatch a task for execution
 *   astro_task_status    → Check execution status
 *
 * Plugin lifecycle:
 *   Gateway loads this module → calls register(api) → tools available to agents
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { AstroClient } from './client.js';
import { listProjects } from './tools/list-projects.js';
import { getPlan } from './tools/get-plan.js';
import { createProject } from './tools/create-project.js';
import { createTask } from './tools/create-task.js';
import { convertToProject } from './tools/convert-to-project.js';
import { runTask } from './tools/run-task.js';
import { taskStatus } from './tools/task-status.js';

// ---------------------------------------------------------------------------
// Agent runner config fallback
// ---------------------------------------------------------------------------

interface AgentRunnerConfig {
  serverUrl?: string;
  authToken?: string;
}

/**
 * Read the agent runner's config to reuse its server URL and auth token.
 *
 * The agent runner uses the `conf` library which stores config at:
 *   - macOS: ~/Library/Preferences/astro-agent-nodejs/config.json
 *   - Linux: ~/.config/astro-agent-nodejs/config.json
 *   - Windows: %APPDATA%/astro-agent-nodejs/config.json
 *
 * Falls back to legacy ~/.astro/config.json if the conf-based config isn't found.
 */
function readAgentRunnerConfig(): AgentRunnerConfig {
  // Try conf-based config first (current agent runner)
  const confPaths = [
    join(homedir(), 'Library', 'Preferences', 'astro-agent-nodejs', 'config.json'), // macOS
    join(homedir(), '.config', 'astro-agent-nodejs', 'config.json'), // Linux
  ];

  for (const configPath of confPaths) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        serverUrl: raw.apiUrl || raw.serverUrl || undefined,
        authToken: raw.accessToken || raw.authToken || undefined,
      };
    } catch {
      // Try next path
    }
  }

  // Legacy fallback: ~/.astro/config.json
  try {
    const configPath = join(homedir(), '.astro', 'config.json');
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return {
      serverUrl: raw.serverUrl || undefined,
      authToken: raw.authToken || undefined,
    };
  } catch {
    return {};
  }
}

// Re-exports for programmatic usage
export { AstroClient, AstroApiError } from './client.js';
export type { AstroClientConfig } from './client.js';
export type {
  OpenClawPlugin,
  OpenClawToolDefinition,
  OpenClawToolResult,
  PluginConfig,
  RegisteredTool,
  ToolHandler,
} from './types.js';
export { listProjectsToolDef, listProjects } from './tools/list-projects.js';
export type { ProjectSummary } from './tools/list-projects.js';
export { getPlanToolDef, getPlan } from './tools/get-plan.js';
export type { PlanGraph, PlanNode, PlanEdge } from './tools/get-plan.js';
export { createProjectToolDef, createProject } from './tools/create-project.js';
export type { CreateProjectInput } from './tools/create-project.js';
export { createTaskToolDef, createTask } from './tools/create-task.js';
export type { CreateTaskInput } from './tools/create-task.js';
export { convertToProjectToolDef, convertToProject } from './tools/convert-to-project.js';
export type { ConvertToProjectInput } from './tools/convert-to-project.js';
export { runTaskToolDef, runTask } from './tools/run-task.js';
export type { DispatchTaskResponse, RunTaskInput } from './tools/run-task.js';
export { taskStatusToolDef, taskStatus } from './tools/task-status.js';
export type { TaskExecution } from './tools/task-status.js';

// ---------------------------------------------------------------------------
// createPlugin — standalone usage (not via gateway)
// ---------------------------------------------------------------------------

import type { PluginConfig, OpenClawPlugin, RegisteredTool, OpenClawToolResult } from './types.js';
import { listProjectsToolDef } from './tools/list-projects.js';
import { getPlanToolDef } from './tools/get-plan.js';
import { createProjectToolDef } from './tools/create-project.js';
import { createTaskToolDef } from './tools/create-task.js';
import { convertToProjectToolDef } from './tools/convert-to-project.js';
import { runTaskToolDef } from './tools/run-task.js';
import { taskStatusToolDef } from './tools/task-status.js';

export function createPlugin(config: PluginConfig): OpenClawPlugin {
  const client = new AstroClient({
    serverUrl: config.serverUrl,
    authToken: config.authToken,
    teamId: config.teamId,
  });

  const tools = new Map<string, RegisteredTool>([
    [listProjectsToolDef.name, { definition: listProjectsToolDef, handler: () => listProjects(client) }],
    [getPlanToolDef.name, { definition: getPlanToolDef, handler: (input) => getPlan(client, input as { projectId: string }) }],
    [createProjectToolDef.name, { definition: createProjectToolDef, handler: (input) => createProject(client, input as { name: string; [k: string]: unknown }) }],
    [createTaskToolDef.name, { definition: createTaskToolDef, handler: (input) => createTask(client, input as { projectId: string; title: string; [k: string]: unknown }) }],
    [convertToProjectToolDef.name, { definition: convertToProjectToolDef, handler: (input) => convertToProject(client, input as { nodeId: string; projectId: string; [k: string]: unknown }) }],
    [runTaskToolDef.name, { definition: runTaskToolDef, handler: (input) => runTask(client, input as { nodeId: string; projectId: string; [k: string]: unknown }) }],
    [taskStatusToolDef.name, { definition: taskStatusToolDef, handler: (input) => taskStatus(client, input as { executionId: string }) }],
  ]);

  return {
    id: 'astro',
    name: 'Astro Planning Platform',
    version: '0.1.0',
    tools,
    async invoke(toolName: string, input: Record<string, unknown>): Promise<OpenClawToolResult> {
      const tool = tools.get(toolName);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: "${toolName}". Available tools: ${[...tools.keys()].join(', ')}` }],
          isError: true,
        };
      }
      try {
        return await tool.handler(input);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Tool "${toolName}" failed: ${message}` }],
          isError: true,
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Gateway plugin interface — default export for OpenClaw gateway loading
// ---------------------------------------------------------------------------

/**
 * Minimal OpenClaw Plugin API type (matches the gateway's OpenClawPluginApi).
 * We inline the type to avoid depending on openclaw internals.
 */
interface GatewayPluginApi {
  pluginConfig: Record<string, unknown>;
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  registerTool(tool: GatewayTool, opts?: { optional?: boolean }): void;
  config?: Record<string, unknown>;
}

interface GatewayTool {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(id: string, params: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string; data?: unknown }>; isError?: boolean }>;
}

function makeJsonSchemaParameters(schema: {
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean;
}): Record<string, unknown> {
  // The gateway expects a JSON Schema object for parameters
  return schema;
}

export default function register(api: GatewayPluginApi): void {
  const cfg = api.pluginConfig as { serverUrl?: string; authToken?: string; teamId?: string };
  const agentCfg = readAgentRunnerConfig();
  const serverUrl = cfg.serverUrl || agentCfg.serverUrl || 'https://astro-backend-deploy.fly.dev';
  const authToken = cfg.authToken || agentCfg.authToken || '';
  const teamId = cfg.teamId || undefined;

  const client = new AstroClient({ serverUrl, authToken, teamId });

  if (agentCfg.authToken && !cfg.authToken) {
    api.logger.info(`[astro] Using auth token from ~/.astro/config.json`);
  }
  api.logger.info(`[astro] Connecting to Astro backend at ${serverUrl}`);

  // Register: astro_list_projects
  api.registerTool({
    name: 'astro_list_projects',
    label: 'Astro: List Projects',
    description: listProjectsToolDef.description,
    parameters: makeJsonSchemaParameters(listProjectsToolDef.inputSchema),
    async execute(_id, _params) {
      return listProjects(client);
    },
  });

  // Register: astro_get_plan
  api.registerTool({
    name: 'astro_get_plan',
    label: 'Astro: Get Plan',
    description: getPlanToolDef.description,
    parameters: makeJsonSchemaParameters(getPlanToolDef.inputSchema),
    async execute(_id, params) {
      return getPlan(client, params as { projectId: string });
    },
  });

  // Register: astro_create_project
  api.registerTool({
    name: 'astro_create_project',
    label: 'Astro: Create Project',
    description: createProjectToolDef.description,
    parameters: makeJsonSchemaParameters(createProjectToolDef.inputSchema),
    async execute(_id, params) {
      return createProject(client, params as { name: string; [k: string]: unknown });
    },
  });

  // Register: astro_create_task
  api.registerTool({
    name: 'astro_create_task',
    label: 'Astro: Create Task',
    description: createTaskToolDef.description,
    parameters: makeJsonSchemaParameters(createTaskToolDef.inputSchema),
    async execute(_id, params) {
      return createTask(client, params as { projectId: string; title: string; [k: string]: unknown });
    },
  });

  // Register: astro_convert_to_project
  api.registerTool({
    name: 'astro_convert_to_project',
    label: 'Astro: Convert Task to Project',
    description: convertToProjectToolDef.description,
    parameters: makeJsonSchemaParameters(convertToProjectToolDef.inputSchema),
    async execute(_id, params) {
      return convertToProject(client, params as { nodeId: string; projectId: string; [k: string]: unknown });
    },
  });

  // Register: astro_run_task
  api.registerTool({
    name: 'astro_run_task',
    label: 'Astro: Run Task',
    description: runTaskToolDef.description,
    parameters: makeJsonSchemaParameters(runTaskToolDef.inputSchema),
    async execute(_id, params) {
      return runTask(client, params as { nodeId: string; projectId: string; [k: string]: unknown });
    },
  });

  // Register: astro_task_status
  api.registerTool({
    name: 'astro_task_status',
    label: 'Astro: Task Status',
    description: taskStatusToolDef.description,
    parameters: makeJsonSchemaParameters(taskStatusToolDef.inputSchema),
    async execute(_id, params) {
      return taskStatus(client, params as { executionId: string });
    },
  });
}
