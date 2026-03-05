# @astroanywhere/openclaw-plugin

OpenClaw plugin that exposes [Astro](https://github.com/fuxialexander/astro) project/plan/task management as gateway tools.

## Tools

| Tool | Gateway Method | Description |
|------|---------------|-------------|
| `astro_list_projects` | `astro.projects.list` | List all Astro projects |
| `astro_get_plan` | `astro.projects.getPlan` | Get the plan graph (nodes + edges) for a project |
| `astro_create_project` | `astro.projects.create` | Create a new project |
| `astro_create_task` | `astro.tasks.create` | Add a task (plan node) to a project |
| `astro_convert_to_project` | `astro.tasks.convertToProject` | Convert a task into a standalone project |
| `astro_run_task` | `astro.dispatch.task` | Dispatch a task for execution on an agent runner |
| `astro_task_status` | `astro.dispatch.taskStatus` | Get execution status and output for a dispatched task |

## Installation

### Via OpenClaw CLI

```bash
openclaw plugins install --link /path/to/openclaw-plugin

# Set the Astro backend URL
openclaw config set plugins.entries.astro.config.serverUrl "http://localhost:3001"

# Restart the gateway to load the plugin
openclaw gateway restart
```

### Verify

```bash
openclaw plugins info astro
# Should show: Status: loaded, Tools: astro_list_projects, ...
```

## Usage

### Via OpenClaw Agent (Telegram, iMessage, etc.)

Once installed, the tools are available to the OpenClaw agent. You can ask:

- "List my Astro projects"
- "Create a project called Weather Dashboard"
- "Add a task to project X: Set up CI/CD pipeline"
- "Get the plan for project X"
- "Convert task Y in project X to a standalone project"
- "Run task Y in project X"
- "Check the status of execution Z"

### Programmatic Usage

```typescript
import { createPlugin } from '@astroanywhere/openclaw-plugin'

const plugin = createPlugin({
  serverUrl: 'http://localhost:3001',
  authToken: '',
})

// List projects
const projects = await plugin.invoke('astro_list_projects', {})

// Create a project
const project = await plugin.invoke('astro_create_project', {
  name: 'My Project',
  description: 'A new project',
})

// Add a task
const task = await plugin.invoke('astro_create_task', {
  projectId: 'project-uuid',
  title: 'Implement feature X',
  priority: 'high',
  estimate: 'M',
})

// Convert a task to its own project
const converted = await plugin.invoke('astro_convert_to_project', {
  nodeId: 'node-uuid',
  projectId: 'source-project-uuid',
  newProjectName: 'Feature X Project',
})

// Run a task
const execution = await plugin.invoke('astro_run_task', {
  nodeId: 'node-uuid',
  projectId: 'project-uuid',
})

// Check execution status
const status = await plugin.invoke('astro_task_status', {
  executionId: 'execution-uuid',
})
```

## Configuration

The plugin is configured via OpenClaw's plugin config system (`openclaw.json` → `plugins.entries.astro.config`):

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `serverUrl` | Yes | `http://localhost:3001` | Base URL of the Astro backend API |
| `authToken` | No | `""` | Bearer token for API auth (empty in local/no-auth mode) |
| `teamId` | No | `""` | Team ID to scope API requests (optional in single-user mode) |

## Development

```bash
npm install
npm run build    # TypeScript compilation
npm test         # Run tests (32 tests)
```
