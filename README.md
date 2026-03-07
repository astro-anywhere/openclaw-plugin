# @astroanywhere/openclaw-plugin

OpenClaw gateway plugin for [Astro](https://github.com/astro-anywhere/astro) — exposes project/plan/task management as tools available to OpenClaw agents.

## Tools

| Tool | Description |
|------|-------------|
| `astro_list_projects` | List all projects |
| `astro_get_plan` | Get the plan graph (nodes + edges) for a project |
| `astro_create_project` | Create a new project |
| `astro_create_task` | Add a task node to a project's plan |
| `astro_convert_to_project` | Convert a task into a standalone project |
| `astro_run_task` | Dispatch a task for execution on an agent runner |
| `astro_task_status` | Poll execution status and output |

## Install

```bash
openclaw plugins install @astroanywhere/openclaw-plugin
openclaw config set plugins.entries.astro.config.serverUrl "https://api.astroanywhere.com"
openclaw gateway restart
```

For local development against a local Astro backend:

```bash
openclaw plugins install --link /path/to/openclaw-plugin
openclaw config set plugins.entries.astro.config.serverUrl "http://localhost:3001"
openclaw gateway restart
```

Verify:

```bash
openclaw plugins info astro
```

## Configuration

Set via `openclaw config set plugins.entries.astro.config.<key>`:

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `serverUrl` | Yes | `http://localhost:3001` | Astro backend URL |
| `authToken` | No | `""` | Bearer token (empty in local/no-auth mode) |
| `teamId` | No | `""` | Team ID to scope requests |

## Structure

```
src/
  index.ts          # Plugin entry — register() for gateway, createPlugin() for standalone
  client.ts         # HTTP client wrapping Astro's /api/* endpoints
  types.ts          # OpenClaw plugin SDK types (tool definitions, results)
  tools/            # One file per tool (list-projects, get-plan, create-task, etc.)
openclaw.plugin.json  # Plugin manifest (id, tools, config schema)
```

## Development

```bash
npm install
npm run build    # TypeScript -> dist/
npm test         # Vitest
```

The gateway default export is `register(api)` which receives the OpenClaw plugin API and registers all tools. For standalone/programmatic use, import `createPlugin(config)` instead.
